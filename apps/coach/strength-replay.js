/** Deterministic selection from revisioned facts. Derived learning summaries are never evidence. */
(function(root) {
  const RIR={very_easy:6,easy:6,average:3,hard:1,max_effort:0};
  const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
  const number=value=>['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
  const compare=(a,b)=>a<b?-1:a>b?1:0;
  function stable(value) {
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    return value;
  }
  const serial=value=>JSON.stringify(stable(value));
  const clone=value=>JSON.parse(JSON.stringify(value));
  function fact(record) {
    // Compatibility summaries are disposable: changing one cannot change evidence.
    const copy=clone(record);
    if(copy.payload)delete copy.payload.learning;
    return stable(copy);
  }
  function ownerMatches(record,ownerId) {
    return record?.payload?.ownerId===ownerId&&['ownerId','athleteId','athlete_id'].every(key=>!Object.prototype.hasOwnProperty.call(record,key)||record[key]===ownerId);
  }
  function context(record) {
    const p=record.payload,page=p?.page,load=root.StrengthContext.normalizeLoad(p?.normalizedLoad);
    if(!load)return null;
    const convention=['barbell_total','barbell_plates'].includes(load.convention)?'barbell_total':load.convention;
    try{return root.StrengthContext.key({athleteId:p.ownerId,exerciseId:page?.exerciseId,equipmentId:page?.equipmentId,convention,tempo:page?.tempo});}
    catch{return null;}
  }
  function time(record) {
    const raw=record.payload?.sessionStartedAt;
    if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0?raw:null;
    if(typeof raw!=='string'||!raw.trim())return null;
    const numeric=number(raw);if(numeric!=null)return numeric>=0?numeric:null;
    const parsed=Date.parse(raw);return Number.isFinite(parsed)&&parsed>=0?parsed:null;
  }
  function order(a,b) {
    return compare(time(a)??Infinity,time(b)??Infinity)||compare(a.sessionId??'',b.sessionId??'')||
      compare(a.payload?.row?.ordinal??Infinity,b.payload?.row?.ordinal??Infinity)||compare(a.id,b.id);
  }
  function identity(record) {
    const {page,row}=record.payload||{};
    if(!page||!row||!Number.isSafeInteger(row.ordinal)||row.ordinal<0)return null;
    let targets;try{targets=root.StrengthTargets.normalize(page);}catch{return null;}
    if(row.purpose==='ramp'||row.purpose==='warmup')return {purpose:'warmup',workingIndex:-1};
    // Target identity establishes position even if a prior set was never logged.
    const target=targets.find(t=>t.id===row.targetId);
    if(!target||row.purpose!==target.purpose)return null;
    const workingIndex=targets.filter(t=>t.purpose==='working').findIndex(t=>t.id===target.id);
    if(target.purpose==='working'&&row.workingIndex!==workingIndex)return null;
    return {purpose:target.purpose,workingIndex};
  }
  function derive(record,contextKey) {
    const p=record.payload,{row,page}=p;
    const position=identity(record);
    if(!position||position.purpose!=='working'||position.workingIndex!==0)return {reason:'not_first_working'};
    if(row.logged!==true||row.deleted||row.skipped)return {reason:'unlogged_first_working'};
    if(typeof row.miss!=='boolean')return {reason:'invalid_actual'};
    const reps=number(row.reps),actual=number(row.kg);
    if(!Number.isSafeInteger(reps)||reps<0||(reps===0&&!row.miss)||actual==null||actual<0)return {reason:'invalid_actual'};
    const normalized=root.StrengthContext.normalizeLoad(p.normalizedLoad);
    if(!normalized||!normalized.eligible||root.StrengthContext.classifyLegacy(p)!=='known_legacy_version')return {reason:'ambiguous_load'};
    const expected=root.StrengthLoad.fromPage({page,value:actual,provenance:normalized.provenance});
    if(!expected||Object.keys(expected).some(key=>expected[key]!==normalized[key]))return {reason:'load_actual_mismatch'};
    const supported=(!page.columns||Array.isArray(page.columns))&&root.StrengthBrainCore.supported({...page,loadUnit:'kg'});
    if(!supported||page.equipmentId==='bodyweight'||normalized.convention==='added_bodyweight'||[p,page,row].some(source=>source.modelEligible===false||source.model!=null))return {reason:'unsupported_model'};
    const effort=row.effort==='medium'?'average':row.effort;
    const rir=Object.prototype.hasOwnProperty.call(RIR,effort)?RIR[effort]:null;
    if(rir==null&&!row.miss)return {reason:'invalid_effort'};
    const observation={id:record.id,revision:record.localRevision,contextKey,sessionId:record.sessionId,
      weight:normalized.externalKg,reps,rir,purpose:'working',workingIndex:0,miss:row.miss,completed:true};
    // Equipment values use the original display grid. Normalize the difference once.
    const next=root.StrengthEquipment.next(actual,page);
    const delta=next==null?null:next-actual;
    const stepKg=delta!=null&&delta>0?delta*(page.loadUnit==='lb'?.45359237:1):null;
    return {evidence:{observation,effort:effort??null,sessionStartedAt:time(record),stepKg,
      page:clone(page),row:clone(row),normalizedLoad:normalized}};
  }
  function replay(records,{ownerId,contextKey,excludeSessionId}={}) {
    const L=root.StrengthLearning,contextCache=new WeakMap();
    let scope=null;
    try{const tuple=JSON.parse(contextKey);if(Array.isArray(tuple)&&tuple.length===5&&tuple.slice(0,3).every(text))scope=tuple;}catch{}
    const keyOf=record=>{
      if(!contextCache.has(record)){
        const p=record.payload,page=p?.page;
        // Identity can reject unrelated exercises cheaply. Matching identities
        // still pass the complete physical-envelope validation before use.
        const unrelated=scope&&(p?.ownerId!==scope[0]||page?.exerciseId!==scope[1]||page?.equipmentId!==scope[2]);
        contextCache.set(record,unrelated?null:context(record));
      }
      return contextCache.get(record);
    };
    const diagnostics=[],byId=new Map();
    const diagnostic=(record,reason)=>diagnostics.push({id:record.id,sessionId:record.sessionId??null,reason});
    // Resolve revisions before eligibility, so deletion/reopen/context edits cannot resurrect old evidence.
    for(const record of Array.isArray(records)?records:[]) {
      if(!record||!text(record.id)||!Number.isSafeInteger(record.localRevision)||record.localRevision<1)continue;
      const old=byId.get(record.id);
      if(!old||record.localRevision>old.revision)byId.set(record.id,{revision:record.localRevision,variants:[record]});
      else if(record.localRevision===old.revision)old.variants.push(record);
    }
    const ledger=[],latest=[],relevantSessions=new Set();let conflicted=false;
    for(const [id,entry] of [...byId].sort((a,b)=>compare(a[0],b[0]))) {
      // Most IDs have one latest fact. Canonicalize only conflicts and the scoped
      // output ledger; cloning every unrelated payload blocks large histories.
      const variants=entry.variants.length===1?null:new Map(entry.variants.map(record=>{const raw=fact(record);return [serial(raw),raw];}));
      const all=variants?[...variants].sort((a,b)=>compare(a[0],b[0])).map(pair=>pair[1]):entry.variants;
      const owned=all.filter(record=>text(ownerId)&&ownerMatches(record,ownerId));
      if(!owned.length)continue;
      const scoped=owned.filter(record=>typeof contextKey==='string'&&contextKey.length>0&&record.kind==='set'&&keyOf(record)===contextKey);
      if(all.length>1){
        // A context with unresolved conflicting actuals uses the default curve until resolved.
        if(scoped.length){conflicted=true;ledger.push({id,localRevision:entry.revision,conflicts:scoped});diagnostic(scoped[0],'conflicting_revision');}
        continue;
      }
      const selected=scoped.length?fact(all[0]):all[0];
      if(scoped.length){ledger.push(selected);relevantSessions.add(selected.sessionId);}
      latest.push(selected);
    }
    // Keep every owned set in relevant sessions, including other exercises and
    // tombstones: their completion/time facts still gate the entire session.
    const sessionRecords=latest.filter(record=>record.kind==='set'&&relevantSessions.has(record.sessionId));
    sessionRecords.sort(order);
    const sessions=new Map();
    for(const record of sessionRecords) {
      if(record.kind!=='set')continue;
      if(!text(record.sessionId)||typeof record.deleted!=='boolean'){if(keyOf(record)===contextKey)diagnostic(record,'invalid_record');continue;}
      const bucket=sessions.get(record.sessionId)||[];bucket.push(record);sessions.set(record.sessionId,bucket);
    }
    // updateStart anchors this scale at fixed k0, not the evolving personal k.
    // It is a default-curve seed parameter, never a measured maximum or RTS scale.
    let state=L.initial(),startingScale=null;
    const evidence=[],sessionGates=[];
    for(const bucket of sessions.values()) {
      const relevant=bucket.filter(record=>keyOf(record)===contextKey);
      if(!relevant.length)continue;
      sessionGates.push({sessionId:bucket[0].sessionId,completed:bucket.every(record=>record.payload.completed===true),times:[...new Set(bucket.map(time))].sort(compare)});
      if(bucket[0].sessionId===excludeSessionId)continue;
      // Completion is a session fact, not a claim in a cached observation. A stale
      // completed first set cannot teach while another snapshot says reopened.
      if(bucket.some(record=>record.payload.completed!==true||time(record)==null)||new Set(bucket.map(time)).size!==1){
        for(const record of relevant)diagnostic(record,'incomplete_or_inconsistent_session');continue;
      }
      const first=relevant.filter(record=>{const position=identity(record);return position?.purpose==='working'&&position.workingIndex===0;});
      if(first.length!==1){for(const record of relevant)diagnostic(record,first.length?'duplicate_first_working':'missing_first_working');continue;}
      const record=first[0];
      if(record.deleted){diagnostic(record,'deleted');continue;}
      const result=derive(record,contextKey);
      if(result.reason){diagnostic(record,result.reason);continue;}
      const row=result.evidence;
      evidence.push(row);
      if(!conflicted){state=L.observe(state,row.observation);startingScale=L.updateStart(startingScale,row.observation,row.stepKg);}
    }
    diagnostics.sort((a,b)=>compare(a.id,b.id)||compare(a.reason,b.reason)||compare(a.sessionId??'',b.sessionId??''));
    // Exact canonical content avoids hash collisions in cache invalidation. It
    // includes latest revisions/tombstones/completion/context, never derived summaries.
    const evidenceFingerprint=`facts-v1:${serial({ownerId:ownerId??null,contextKey:contextKey??null,excludeSessionId:excludeSessionId??null,ledger,sessionGates})}`;
    return {...state,startingScale,evidenceFingerprint,conflicted,ledger,diagnostics,evidence,
      latestFirst:evidence.length?clone(evidence[evidence.length-1]):null};
  }
  root.StrengthReplay={replay};
})(typeof window!=='undefined'?window:globalThis);
