/** Shared authored strength targets. Generated copies in athlete/coach; edit this source. */
(function(root) {
  function reps(value) {
    if(value&&typeof value==='object') {
      if(!Number.isSafeInteger(value.min)||!Number.isSafeInteger(value.max))return null;
      value=`${value.min}-${value.max}`;
    }
    const parsed=root.TrainingCore.repTarget(value);
    return parsed?{min:parsed.min,max:parsed.max}:null;
  }
  function validate(targets) {
    const fail=error=>({valid:false,error});
    if(!Array.isArray(targets)||!targets.length)return fail('Add at least one set target.');
    let ordinaryWorking=false;const ids=new Set();
    for(let i=0;i<targets.length;i++) {
      const t=targets[i],label=`Set ${i+1}`;
      if(!t||!['warmup','working','amrap'].includes(t.purpose))return fail(`${label}: choose warmup, working, or AMRAP purpose.`);
      if(t.id!=null) {
        if(typeof t.id!=='string'||!t.id.trim()||ids.has(t.id))return fail(`${label}: use a unique nonempty target ID.`);
        ids.add(t.id);
      }
      if(!['adaptive','first_working_set'].includes(t.loadRule?.kind))return fail(`${label}: choose a supported load rule.`);
      if(typeof t.toFailure!=='boolean')return fail(`${label}: author toFailure as true or false.`);
      if(t.purpose==='amrap') {
        if(t.reps!==null)return fail(`${label}: AMRAP reps must be null.`);
        if(i!==targets.length-1)return fail(`${label}: AMRAP must be the final authored set.`);
        if(!ordinaryWorking)return fail(`${label}: add an ordinary working set before AMRAP.`);
      } else {
        if(!reps(t.reps))return fail(`${label}: enter a positive integer rep target or an increasing rep range.`);
        if(t.purpose==='working')ordinaryWorking=true;
      }
    }
    return {valid:true,error:null};
  }
  function normalize(block) {
    if(!block||typeof block!=='object')throw new RangeError('Provide a strength prescription block.');
    let authored=block.setTargets;
    if(authored==null) {
      if(!Number.isSafeInteger(block.setCount)||block.setCount<1)throw new RangeError('Set count must be a positive integer.');
      const range=block.repMin!=null||block.repMax!=null?reps({min:block.repMin,max:block.repMax??block.repMin})
        :block.repTarget!=null?reps(block.repTarget)
        :block.targetRepMax!=null?reps({min:block.targetReps,max:block.targetRepMax}):reps(block.targetReps);
      if(!range)throw new RangeError('Enter a positive integer rep target or an increasing rep range.');
      authored=Array.from({length:block.setCount},()=>({purpose:'working',reps:range,loadRule:{kind:'adaptive'},toFailure:false}));
    }
    if(!Array.isArray(authored))throw new RangeError('Set targets must be an array.');
    const targets=authored.map((t,i)=>({
      id:t?.id??`${block.id||'block'}:set:${i}`,
      purpose:t?.purpose??'working',
      reps:t?.purpose==='amrap'?(t.reps===undefined?null:t.reps):reps(t?.reps),
      loadRule:{kind:t?.loadRule?.kind??'adaptive'},
      toFailure:t?.toFailure??false
    }));
    const result=validate(targets);
    if(!result.valid)throw new RangeError(result.error);
    return targets;
  }
  function working(targets) {return targets.filter(t=>t.purpose!=='warmup');}
  function forRow(page,row,index) {
    const targets=normalize(page);
    if(row?.purpose==='ramp') {
      return {id:`${page.id||'block'}:warmup:${index}`,purpose:'warmup',reps:reps(row.reps??page.repTarget)||targets.find(t=>t.reps)?.reps||null,loadRule:{kind:'adaptive'},toFailure:false};
    }
    if(row?.targetId!=null)return targets.find(t=>t.id===row.targetId)||null;
    return working(targets)[row?.workingIndex??index]||null;
  }
  function resolveReference(target,rows) {
    if(target?.loadRule?.kind!=='first_working_set')return null;
    const row=rows.find(r=>r&&(r.purpose==null||r.purpose==='working'));
    if(!row?.logged||row.deleted||row.skipped||row.miss||!['number','string'].includes(typeof row.kg)||String(row.kg).trim()==='')return null;
    const kg=Number(row.kg);
    return Number.isFinite(kg)&&kg>=0?kg:null;
  }
  root.StrengthTargets={normalize,forRow,working,resolveReference,validate};
})(typeof window!=='undefined'?window:globalThis);
