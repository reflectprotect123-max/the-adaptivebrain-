/** Canonical strength policy. Physical load maths is separate from display/rack units. */
(function(root) {
  const T=root.StrengthTargets,E=root.StrengthEquipment,DEFAULT=root.StrengthPolicy;
  const effortRpe={average:7,medium:7,hard:9};
  const effortRank={very_easy:0,easy:1,average:2,medium:2,hard:3,max_effort:4};
  const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const ordinary=t=>t&&t.purpose==='working';
  function finiteLoad(n){if(!['number','string'].includes(typeof n)||String(n).trim()==='')return null;const x=Number(n);return Number.isFinite(x)&&x>=0?x:null;}
  function policy(state){return {...DEFAULT,...(state?.policy||{})};}
  function normalized(kg,page) {return root.StrengthLoad?.fromPage({page,value:kg,provenance:'explicit'})??null;}
  function display(physical,page){const n=normalized(0,page);return n?root.StrengthLoad.displayKg({...n,externalKg:physical},n.convention,n.barKg):null;}
  function supported(page) {
    if(['Warm-Up','Cool-Down'].includes(page?.section)||['warmup','cooldown'].includes(page?.role))return false;
    const columns=page?.columns||[];
    if(!Array.isArray(columns))return false;
    const n=normalized(0,page);
    return !!n&&n.convention!=='added_bodyweight'&&page.equipmentId!=='bodyweight'&&page.kind==='lift'&&page.loadUnit==='kg'&&
      columns.some(c=>c==='reps'||c==='reps_range')&&columns.includes('weight_kg')&&
      !/carry|farmer|suitcase|\bhold\b|plank|\bclean\b|\bsnatch\b|\bjump\b/i.test(page.title||'')&&
      !columns.some(c=>!['reps','reps_range','weight_kg'].includes(c));
  }
  function targetFor(page,row,index){try{return T.forRow(page,row,index);}catch{return null;}}
  function intended(target){return target?.purpose==='warmup'?'easy':'average';}
  function estimate(row,page) {
    if(!supported(page)||!row?.logged||row.deleted||row.skipped||row.miss||row.context?.loadAmbiguous||['ramp','warmup','amrap'].includes(row.purpose))return null;
    const reps=finiteLoad(row.reps),rpe=effortRpe[row.effort],n=normalized(row.kg,page);
    if(!Number.isInteger(reps)||reps<1||reps>12||rpe==null||!positive(n?.externalKg))return null;
    const pct=root.StrengthLearning?.fraction(reps+10-rpe,root.StrengthLearning.initial().k);
    return pct?n.externalKg/pct:null;
  }
  function sameSource(previous,evidence){return previous?.lastSourceSignature&&previous.lastSourceSignature===evidence?.sourceSignature;}
  function learn(previous={},evidence={}) {
    const base={freshE1rm:positive(previous.freshE1rm)?Number(previous.freshE1rm):null,exposures:Number(previous.exposures)||0,confidence:previous.confidence||'unknown',modelVersion:DEFAULT.version,lastSourceSignature:previous.lastSourceSignature||null};
    if(!positive(evidence.estimate)||!evidence.sourceSignature||sameSource(base,evidence))return base;
    const blend=Number(evidence.learningBlend??DEFAULT.learningBlend);
    base.freshE1rm=positive(base.freshE1rm)?base.freshE1rm*(1-blend)+Number(evidence.estimate)*blend:Number(evidence.estimate);
    base.exposures+=1;base.confidence=base.exposures>=3?'personal':'provisional';base.modelVersion=evidence.modelVersion||DEFAULT.version;base.lastSourceSignature=evidence.sourceSignature;
    return base;
  }
  function response(kg,target,reason,confidence,p){return {kg,target,ruleVersion:p.version,reason,confidence};}
  function guard(physical,current,page,{transition=false,planned=null,p=DEFAULT}={}) {
    const source=normalized(current,page);if(!source||!Number.isFinite(physical)||physical<0)return finiteLoad(current);
    const raw=display(physical,page);if(raw==null)return finiteLoad(current);
    const mass=source.externalKg,profile=E.profile(page),minimum=normalized(profile.min,page)?.externalKg;
    if(Math.abs(physical-mass)<1e-8)return finiteLoad(current);
    const up=physical>mass,next=E.next(current,page);
    let low=Math.max(minimum??0,mass*(1-p.downCap)),high=mass;
    if(up){
      const plan=finiteLoad(planned),rung=E.next(plan??current,page);
      const stepLimit=normalized(rung,page)?.externalKg??mass;
      high=Math.max(mass,Math.min(mass*(1+(transition ? .1 : p.upCap)),stepLimit));
      if(!transition&&minimum!=null&&Math.abs(mass-minimum)<1e-8&&next!=null)high=normalized(next,page).externalKg;
      low=mass;
    }
    const values=[current,raw,display(low,page),display(high,page)];
    const loads=[current];
    for(const value of values){if(value==null)continue;const f=E.floor(value,page);if(f!=null){loads.push(f);const n=E.next(f,page);if(n!=null)loads.push(n);}}
    let allowed=[...new Set(loads)].filter(kg=>{const m=normalized(kg,page)?.externalKg;return m!=null&&m>=low-1e-8&&m<=high+1e-8;});
    if(!up&&!allowed.some(kg=>kg<current-1e-8)) {
      const lower=E.floor(current-1e-7,page);return lower??finiteLoad(current);
    }
    allowed.sort((a,b)=>Math.abs(a-raw)-Math.abs(b-raw)||a-b);
    return allowed[0]??finiteLoad(current);
  }
  function matchLoad(kg,fromReps,toReps,page,fromRpe=7,toRpe=7,k=root.StrengthLearning?.initial().k){
    const source=normalized(kg,page);if(!source)return null;
    const physical=root.StrengthLearning?.project({weight:source.externalKg,fromReps:Number(fromReps),fromRir:10-fromRpe,toReps:Number(toReps),targetRir:10-toRpe,k});
    const raw=physical==null?null:display(physical,page);return raw==null?null:E.floor(raw,page);
  }
  function suggest({page,row,nextRow,index=0,state={}}) {
    const p=policy(state),nextTarget=targetFor(page,nextRow,index),label=intended(nextTarget),kg=finiteLoad(row?.kg);
    if(nextRow?.logged)return response(finiteLoad(nextRow.kg),label,'logged_actual','exact_reference',p);
    if(nextTarget?.loadRule?.kind==='first_working_set') {
      const ref=T.resolveReference(nextTarget,state.rows||[]);return response(ref,label,ref==null?'reference_unresolved':'first_working_set','exact_reference',p);
    }
    if(!supported(page)||!root.StrengthLearning||!E||kg==null||!nextTarget||row?.context?.loadAmbiguous)return response(kg,label,'unsupported_or_unknown','unknown',p);
    const mass=normalized(kg,page).externalKg,currentTarget=targetFor(page,row,Math.max(0,index-1));
    const reps=finiteLoad(row.reps),miss=!!row.miss||!Number.isInteger(reps)||reps<1||(ordinary(currentTarget)&&reps<currentTarget.reps.min);
    if(miss||row.effort==='max_effort'){
      const reduced=guard(mass*(1-p.downCap),kg,page,{p});
      return response(reduced,label,reduced===kg?'minimum_reached':'reduce_after_incomplete','low',p);
    }
    const warm=nextTarget.purpose==='warmup'||['warmup','ramp'].includes(row.purpose);
    const easy=['very_easy','easy'].includes(row.effort);
    if(warm&&nextTarget.purpose==='warmup'){
      let next=easy?E.next(kg,page)??kg:kg;
      if(!easy&&row.effort==='hard')next=guard(mass*.9,kg,page,{p});
      return response(next,label,next>kg?'warmup_step':next<kg?'reduce_after_incomplete':'warmup_hold','directional',p);
    }
    if(warm&&easy){
      const planned=finiteLoad(nextRow?.kg)??finiteLoad(page.workingKg);
      return response(Math.max(kg,planned??kg),label,'working_load','provisional',p);
    }
    if(easy){
      const next=E.next(kg,page),physical=next==null?mass:normalized(next,page).externalKg;
      const out=guard(physical,kg,page,{p});return response(out,label,out>kg?'easy_directional_step':'easy_hold','directional',p);
    }
    const rpe=effortRpe[row.effort],targetReps=nextTarget.reps?.min;
    if(rpe==null)return response(kg,label,'unknown_effort','unknown',p);
    const fromReps=Number(currentTarget?.reps?.min),transition=Number.isInteger(fromReps)&&fromReps!==targetReps;
    const candidate=state.learning?.k,valid=state.learning?.version==='online-v1'&&Number.isFinite(candidate)&&candidate>=.01&&candidate<=.08;
    const k=p.learningMode==='online'&&valid&&!state.learning?.conflicted?candidate:root.StrengthLearning.initial().k;
    const physical=root.StrengthLearning.project({weight:mass,fromReps:reps,fromRir:10-rpe,toReps:targetReps,targetRir:3,k:k??root.StrengthLearning.initial().k});
    if(physical==null)return response(kg,label,'outside_chart_hold','low',p);
    const out=guard(physical,kg,page,{p,transition,planned:nextRow?.kg});
    return response(out,label,out>kg?'combined_projection_up':out<kg?'combined_projection_down':'combined_projection_hold','broad',p);
  }
  function review(page,rows=[]) {
    let targets=[];try{targets=T.normalize(page);}catch{}
    const ordinaryTargets=targets.filter(ordinary),matched=[],workRows=rows.filter(r=>r?.purpose!=='ramp'&&r?.purpose!=='warmup'&&r?.purpose!=='amrap');
    const linked=workRows.some(r=>r?.targetId);
    for(let i=0;i<ordinaryTargets.length;i++)matched.push(linked?workRows.find(r=>r?.targetId===ordinaryTargets[i].id)||null:workRows[i]||null);
    const complete=ordinaryTargets.length>0&&matched.every(r=>r?.logged&&!r.deleted&&!r.skipped);
    const first=matched[0],e1rm=first?estimate(first,page):null;
    const firstKg=finiteLoad(first?.kg);
    // Finishing reps after backing off the load is not the same achievement.
    // Only compare equal/fewer-rep targets: higher-rep sets may be lighter.
    const loadReduced=firstKg!=null&&matched.some((r,i)=>r?.logged&&!r.deleted&&!r.skipped&&
      ordinaryTargets[i].reps.max<=ordinaryTargets[0].reps.max&&
      (finiteLoad(r.kg)==null||finiteLoad(r.kg)<firstKg-1e-8));
    const earned=complete&&firstKg!=null&&!loadReduced&&matched.every((r,i)=>!r.miss&&Number(r.reps)>=ordinaryTargets[i].reps.max&&effortRank[r.effort]!=null&&effortRank[r.effort]<=effortRank.average);
    const nextKg=firstKg==null?null:earned?(E.next(firstKg,page)??firstKg):firstKg;
    return {e1rm,nextKg,earned,loadReduced,calibrated:positive(e1rm),complete,ruleVersion:DEFAULT.version,sourceSetIds:positive(e1rm)&&first?.id?[first.id]:[]};
  }
  root.StrengthBrainCore={suggest,estimate,review,learn,supported,matchLoad,guard,normalized,display};
})(typeof window!=='undefined'?window:globalThis);
