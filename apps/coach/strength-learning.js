/** Pure bounded candidate maths. Equation reference: STMr 0.1.7 (MIT),
 * inspected at 5fbdef5dae9738b728b8e2669f05f00227268c4c.
 * Original JavaScript implementation; candidate constants remain experimental.
 */
(function(root) {
  const K0=.0333/1.0333,MIN_K=.01,MAX_K=.08;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const positive=value=>Number.isFinite(value)&&value>0;
  const validK=k=>Number.isFinite(k)&&k>=MIN_K&&k<=MAX_K;
  const validReps=reps=>Number.isInteger(reps)&&reps>=1&&reps<=12;
  function initial(){return {version:'online-v1',k:K0,rows:[],accepted:0,updates:0};}
  function fraction(n,k) {
    return Number.isFinite(n)&&n>=1&&n<=15&&validK(k)?1/(1+k*(n-1)):null;
  }
  function supported(row) {
    // No validated system-load model is available in v1. Canonical eligibility
    // is the caller's boundary; explicit unsupported metadata also fails closed.
    return row.modelEligible!==false&&row.model==null&&
      [row.convention,row.normalizedLoad?.convention].every(c=>c==null||['barbell_total','per_hand','single'].includes(c));
  }
  function base(row) {
    return row!=null&&supported(row)&&positive(row.weight)&&validReps(row.reps)&&
      row.purpose==='working'&&row.workingIndex===0&&row.completed===true&&typeof row.miss==='boolean';
  }
  function eligible(row) {
    return base(row)&&!row.miss&&[1,3].includes(row.rir)&&
      ['id','contextKey','sessionId'].every(key=>typeof row[key]==='string'&&row[key].trim().length>0)&&
      Number.isSafeInteger(row.revision)&&row.revision>0;
  }
  function copyRow(row) {
    const {id,revision,contextKey,sessionId,weight,reps,rir,purpose,workingIndex,miss,completed}=row;
    return {id,revision,contextKey,sessionId,weight,reps,rir,purpose,workingIndex,miss,completed};
  }
  function validState(state) {
    return state?.version==='online-v1'&&validK(state.k)&&Array.isArray(state.rows)&&state.rows.length<=24&&
      state.rows.every(eligible)&&Number.isSafeInteger(state.accepted)&&state.accepted>=state.rows.length&&
      Number.isSafeInteger(state.updates)&&state.updates>=0&&state.updates<=state.accepted;
  }
  function fittedShape(rows) {
    const effective=rows.map(row=>row.reps+row.rir);
    if(rows.length<8||new Set(effective).size<3||Math.max(...effective)-Math.min(...effective)<4)return null;
    // Normalize residuals by the largest observed weight. This preserves the
    // minimizer while keeping dot products and squared errors finite.
    const largest=Math.max(...rows.map(row=>row.weight));
    function loss(k) {
      const factors=effective.map(n=>fraction(n,k));
      let numerator=0,denominator=0;
      for(let i=0;i<rows.length;i++){
        numerator+=factors[i]*(rows[i].weight/largest);
        denominator+=factors[i]*factors[i];
      }
      const scale=numerator/denominator;
      return rows.reduce((sum,row,i)=>sum+(row.weight/largest-scale*factors[i])**2,0);
    }
    let low=MIN_K,high=MAX_K;
    for(let iteration=0;iteration<32;iteration++){
      const left=low+(high-low)/3,right=high-(high-low)/3;
      if(loss(left)<loss(right))high=right;else low=left;
    }
    const k=(low+high)/2;
    return validK(k)&&Number.isFinite(loss(k))?k:null;
  }
  function observe(previous,observation) {
    // Corrupt caches are discarded; replay is responsible for rebuilding facts.
    if(!validState(previous))return initial();
    const next={version:'online-v1',k:previous.k,rows:previous.rows.map(copyRow),accepted:previous.accepted,updates:previous.updates};
    if(!eligible(observation)||previous.accepted===Number.MAX_SAFE_INTEGER)return next;
    if(next.rows.some(row=>row.contextKey!==observation.contextKey))return next;
    next.rows.push(copyRow(observation));next.rows=next.rows.slice(-24);next.accepted++;
    const fit=fittedShape(next.rows);
    if(fit!=null){
      const confidence=clamp((next.rows.length-6)/(next.rows.length+6),0,.85);
      const target=K0*(1-confidence)+fit*confidence;
      next.k=clamp(target,Math.max(MIN_K,previous.k-.002),Math.min(MAX_K,previous.k+.002));
      next.updates++;
    }
    return next;
  }
  function project(input) {
    if(!input)return null;
    const {weight,fromReps,fromRir,toReps,targetRir,k}=input;
    if(!positive(weight)||!validReps(fromReps)||!validReps(toReps)||!Number.isFinite(fromRir)||fromRir<0||fromRir>3||
      !Number.isFinite(targetRir)||targetRir<0||targetRir>3)return null;
    const from=fraction(fromReps+fromRir,k),to=fraction(toReps+targetRir,k);
    if(from==null||to==null)return null;
    const result=weight*(to/from);
    return positive(result)?result:null;
  }
  function updateStart(scale,observation,step) {
    const fallback=scale==null?null:positive(scale)?scale:null;
    if(scale!=null&&fallback==null)return null;
    if(!positive(step)||!base(observation))return fallback;
    const precise=[1,3].includes(observation.rir);
    if(scale==null){
      if(observation.miss||!precise)return null;
      const seed=observation.weight/fraction(observation.reps+observation.rir,K0);
      return positive(seed)?seed:null;
    }
    const pct=fraction(observation.reps+3,K0),oneStep=step/pct;
    if(!positive(oneStep))return fallback;
    let result=scale;
    if(observation.miss)result=Math.max(scale*.9,scale-oneStep*2);
    else if(Number.isFinite(observation.rir)&&observation.rir>=5)result=scale+oneStep;
    else if(precise){
      const implied=observation.weight/fraction(observation.reps+observation.rir,K0);
      if(!positive(implied))return fallback;
      result=Math.max(scale-Math.max(scale*.1,oneStep),Math.min(scale+oneStep,scale+.5*(implied-scale)));
    }
    return positive(result)?result:fallback;
  }
  root.StrengthLearning={initial,fraction,observe,project,updateStart};
})(typeof window!=='undefined'?window:globalThis);
