/** Coach assigned_session -> athlete library. Server-owned plans, athlete-owned actuals. */
(function(root) {
  const clone=x=>JSON.parse(JSON.stringify(x));
  const META=['equipmentId','loadConvention','exerciseType','minimumKg','barWeightKg','equipmentStepKg','availableLoads','rampCount','bodyRegion','startingKg'];
  let epoch=0,flight=null;
  let status={ok:false,reason:'not_synced',count:0};
  function values(value,count) {
    const a=Array.isArray(value)?value.map(String):String(value??'').split(/[,/]/).map(x=>x.trim());
    if(a.length>count)throw new Error('More set prescriptions than sets');
    while(a.length<count)a.push(a.at(-1)||'');
    return a;
  }
  function columnValues(c,count){return values(c.values?.length?c.values:c.value,count);}
  function exercise(ex,b,id) {
    const count=ex.setCount??ex.sets;
    if(!Number.isSafeInteger(Number(count))||Number(count)<1||Number(count)>100)throw new Error('Coach exercise needs a valid set count');
    const n=Number(count),role=b.role||(/warm.?up/i.test(b.category||'')?'warmup':/cool.?down/i.test(b.category||'')?'cooldown':null);
    const cols=(ex.logColumns||[]).map(c=>({...c,kind:root.TrainingCore.canonical(c.kind)}));
    let columns=Array.isArray(ex.columns)?ex.columns.map(root.TrainingCore.canonical):cols.map(c=>c.kind);
    if(!columns.length) {
      const metric=String(ex.metric||'Weight').toLowerCase();
      const exact=root.TrainingCore.definitions.find(d=>[d.key,d.label.toLowerCase()].includes(metric));
      columns=metric==='weight'?['reps','weight_kg']:exact?[exact.key]:
        /^(seconds?|time)$/.test(metric)?['seconds']:/^(metres?|meters?|distance)$/.test(metric)?['meters']:null;
      if(!columns)throw new Error('Unknown Coach metric');
    }
    if(columns.some(c=>!root.TrainingCore.metric(c)))throw new Error('Unknown Coach metric');
    // Legacy Coach editor stripped an unprescribed kg target while retaining Metric: Weight.
    if(ex.metric==='Weight'&&columns.some(c=>['reps','reps_range'].includes(c))&&!columns.some(c=>['weight_kg','weight_lb','weight_pct','lwp'].includes(c)))columns.push('weight_kg');
    const repCol=cols.find(c=>['reps','reps_range'].includes(c.kind));
    let targets=ex.setTargets?clone(ex.setTargets):null;
    if(!targets&&columns.some(c=>['reps','reps_range'].includes(c))) {
      const reps=repCol?columnValues(repCol,n):values(ex.repTarget??ex.reps,n);
      targets=reps.map((value,i)=>{
        const amrap=/^amrap(?:\s.*)?$/i.test(value);
        const range=root.TrainingCore.repTarget(value);
        if(!amrap&&!range)throw new Error('Coach exercise needs valid reps');
        return {id:`${id}:set:${i}`,purpose:amrap?'amrap':'working',reps:amrap?null:{min:range.min,max:range.max},
          loadRule:{kind:amrap?'first_working_set':'adaptive'},toFailure:amrap};
      });
    }
    if(targets){
      if(targets.length!==n)throw new Error('Coach set count does not match targets');
      targets=root.StrengthTargets.normalize({id,setTargets:targets});
      columns=columns.filter(c=>!['reps','reps_range'].includes(c));
      columns.unshift(targets.some(t=>t.reps&&t.reps.min!==t.reps.max)?'reps_range':'reps');
    }
    const title=String(ex.title||ex.name||'').trim();
    if(!title)throw new Error('Coach exercise needs a name');
    const notes=[ex.coachNote,b.notes,b.coachNote,b.instructions].flat().filter(Boolean).map(String);
    if(/^(yes|each|per side)$/i.test(ex.perSide||''))notes.push('Complete the prescription on each side.');
    if(ex.load)notes.push(`Coach load: ${ex.load}`);
    // Keep authored values as prescription metadata, never fabricated completed actuals.
    const prescribed=cols.filter(c=>!['reps','reps_range'].includes(c.kind)).map(c=>columnValues(c,n).join(' / ')).join(' · ');
    const block={id,kind:'lift',title,exerciseId:ex.exerciseId||null,columns:[...new Set(columns)],setCount:n,
      repTarget:ex.repTarget??ex.reps,setTargets:targets,tempo:ex.tempo||b.tempo||null,role,notes,
      prescribed:ex.prescribed||prescribed||(!targets?String(ex.reps||''):''),groupId:b.groupId||null,
      coachAssignmentId:id.split(':')[1],coachExerciseId:ex.id||null,coachBlockId:b.id||null};
    for(const key of META)if(ex[key]!=null)block[key]=clone(ex[key]);
    carryFields(block, ex, role);
    return block;
  }
  function carryFields(block, ex, role) {
    const rest=Number(ex?.restSec??block.restSec);if(Number.isFinite(rest)&&rest>=0&&rest<=600)block.restSec=Math.round(rest);
    const ci=Number(ex?.countIn??block.countIn);if(Number.isFinite(ci)&&ci>0&&ci<=10)block.countIn=Math.round(ci);
    if(/^(yes|each|per side)$/i.test(ex?.perSide||'')||block.perSide===true)block.eachSide=true;
    if(role==='warmup')block.section='Warm-Up';else if(role==='cooldown')block.section='Cool-Down';
  }
  function convert(row) {
    const date=row.scheduled_date;
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid Coach date');
    if(typeof row.id!=='string'||!row.id)throw new Error('Invalid Coach assignment ID');
    const snapshot=row.resolved_snapshot,session=snapshot?.htmlSession;
    if(!session||!Array.isArray(session.blocks))throw new Error('Unsupported Coach workout snapshot');
    const blocks=[];
    session.blocks.forEach((b,i)=>{
      if(root.StrengthOnly.isConditioning(b))return;
      const id=`coach:${row.id}:${b.id||i}`;
      if(b.kind==='lift'||b.kind==='circuit') {
        const block={...clone(b),id,coachAssignmentId:row.id,coachExerciseId:b.id};
        const role=block.role||(/warm.?up/i.test(block.category||'')?'warmup':/cool.?down/i.test(block.category||'')?'cooldown':null);
        carryFields(block, (b.exercises||[])[0], role);
        blocks.push(block);return;
      }
      if(Array.isArray(b.exercises)&&b.exercises.length) {
        b.exercises.forEach((ex,j)=>blocks.push(exercise(ex,b,`${id}:${ex.id||j}`)));
      } else if(b.instructions||b.coachNote) {
        blocks.push({id,kind:'circuit',title:b.heading||b.title||b.category||'Preparation',instructions:b.instructions||b.coachNote,
          role:b.role||(/cool.?down/i.test(b.category||'')?'cooldown':'warmup')});
      }
    });
    return {id:row.id,date,title:session.name||session.sessionTitle||'Coach workout',instructions:session.coachInstructions||'',blocks};
  }
  function apply(state,rows,uid) {
    if(!uid||state.accountId!==uid)throw new Error('Coach account changed');
    const seen=new Set(),days=new Map();
    for(const row of rows) {
      if(row.athlete_id!==uid)throw new Error('Coach athlete mismatch');
      if(row.state!=='published')continue;
      if(seen.has(row.id))throw new Error('Duplicate Coach assignment');
      seen.add(row.id);
      const item=convert(row);if(!item.blocks.length)continue;
      if(!days.has(item.date))days.set(item.date,[]);
      days.get(item.date).push(item);
    }
    const library=root.HybridLibrary.ensure(clone(state.library||null)),old=library.templates.filter(t=>t.source==='coach-assignment');
    const owned=new Set(old.map(t=>t.id));
    library.templates=library.templates.filter(t=>!owned.has(t.id));
    for(const [date,id] of Object.entries(library.assignments))if(owned.has(id))delete library.assignments[date];
    const conflicts=[];
    for(const [date,items] of [...days].sort(([a],[b])=>a.localeCompare(b))) {
      items.sort((a,b)=>a.id.localeCompare(b.id));
      const id='coach-day:'+date;
      library.templates.push({id,source:'coach-assignment',coachAssignedIds:items.map(x=>x.id),
        title:items.map(x=>x.title).join(' + '),instructions:items.map(x=>x.instructions).filter(Boolean).join('\n\n'),blocks:items.flatMap(x=>x.blocks)});
      if(!library.assignments[date])library.assignments[date]=id;
      else conflicts.push(date); // Never silently replace a locally assigned workout.
    }
    const next={...state,library:root.HybridLibrary.ensure(library)};
    return {state:next,changed:JSON.stringify(next.library)!==JSON.stringify(state.library),count:seen.size,conflicts};
  }
  function defaultIo() {
    const db=root.Whoop.client();
    return {
      async userId(){const {data,error}=await db.auth.getSession();if(error)throw error;return data.session?.user.id||null;},
      async pull(uid){
        const rows=[];
        for(let offset=0;;offset+=500){
          const {data,error}=await db.from('assigned_session').select('id,athlete_id,scheduled_date,state,resolved_snapshot')
            .eq('athlete_id',uid).eq('state','published').order('id').range(offset,offset+499);
          if(error)throw error;rows.push(...data);if(data.length<500)break;
        }
        return rows;
      }
    };
  }
  function invalidate(){epoch++;flight=null;status={ok:false,reason:'account_changed',count:0};}
  function sync(options={}) {
    if(flight)return flight;
    const started=epoch;
    const task=(async()=>{
      try{
        if(root.navigator?.onLine===false)return status={ok:false,reason:'offline',count:0};
        const io=options.io||defaultIo(),uid=await io.userId();
        if(!uid)return status={ok:false,reason:'auth_required',count:0};
        if(root.S.accountId!==uid)return {ok:false,reason:'account_changed'};
        const rows=await io.pull(uid);
        if(started!==epoch||await io.userId()!==uid||root.S.accountId!==uid)return {ok:false,reason:'account_changed'};
        const result=apply(root.S,rows,uid);
        if(result.changed){
          const previous=root.S.library;root.S.library=result.state.library;
          try{root.save?.();}catch(error){root.S.library=previous;throw error;}
          if(!root.S.loggerOpen)root.render?.();
        }
        return status={ok:true,count:result.count,conflicts:result.conflicts};
      }catch(error){return status={ok:false,reason:error.message||'Coach sync failed',count:0};}
    })();
    flight=task;task.finally(()=>{if(flight===task)flight=null;});return task;
  }
  root.CoachAssignments={convert,apply,sync,invalidate,getStatus:()=>({...status})};
})(typeof window!=='undefined'?window:globalThis);
