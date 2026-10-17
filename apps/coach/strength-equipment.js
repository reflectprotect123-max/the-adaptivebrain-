/** Shared equipment loads and provisional product defaults. Edit this canonical source. */
(function(root) {
  const VERSION='equipment-starters-v1';
  const EPS=1e-8;
  function number(value) {
    if(!['number','string'].includes(typeof value)||String(value).trim()==='')return null;
    const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
  }
  function identity(page) {
    if(typeof page.equipmentId==='string'&&page.equipmentId.trim())return page.equipmentId.trim().toLowerCase();
    const title=page.title||'';
    if(/\bdumbbell\b|\bdb\b/i.test(title))return 'dumbbell';
    if(/\bbarbell\b/i.test(title))return 'barbell';
    return '';
  }
  function unique(loads) {return [...new Set(loads)].sort((a,b)=>a-b);}
  function explicitLoads(page) {
    return Array.isArray(page.availableLoads)?unique(page.availableLoads.map(number).filter(n=>n!=null)):[];
  }
  function metadata(page) {
    const unit=page.loadUnit||'',convention=page.loadConvention||'',equipment=identity(page);
    const canonicalBar=['barbell_plates','barbell_total'].includes(convention);
    const declared=canonicalBar?number(page.barWeightKg??page.minimumKg):(number(page.minimumKg)??number(page.barWeightKg));
    const db=equipment==='dumbbell'&&unit==='kg'&&['per_hand','single'].includes(convention);
    const bar=equipment==='barbell'&&unit==='kg'&&(canonicalBar?declared>0:convention==='total'&&declared!=null);
    // Legacy `total` is the existing plates keypad convention, never a persisted-load inference.
    const plates=convention==='total'||convention==='barbell_plates';
    const grid=(number(page.equipmentStepKg)??0)>0&&declared!=null&&(!canonicalBar||bar);
    return {unit,convention,declared,db,bar,plates,grid};
  }
  function profile(page={}) {
    const m=metadata(page);
    const explicit=explicitLoads(page);
    if(explicit.length) {
      const loads=explicit;
      return {loads,step:0,min:loads[0]??0,convention:m.convention,unit:m.unit};
    }
    const step=m.db?2.5:m.bar?(number(page.equipmentStepKg)||2.5):m.grid?number(page.equipmentStepKg):0;
    // Grids remain in display units: plates start at 0; explicit totals include the bar.
    const min=m.db?Math.max(1,m.declared??1):m.bar?(m.plates?0:m.declared):m.grid?m.declared:0;
    const loads=m.db?[1,2,3,4,5,6,7,8,9,10,12.5,15,17.5,20].filter(n=>n>=min):m.bar||m.grid?[min,min+step]:[];
    return {loads,step,min,convention:m.convention,unit:m.unit};
  }
  // Seed profiles stay compact; supply neighboring rungs around every queried value.
  // This covers high loads without allocating a ladder with an arbitrary upper limit.
  function rack(page,values) {
    const p=profile(page),m=metadata(page);
    if(explicitLoads(page).length||!p.step)return p.loads;
    const loads=[...p.loads];
    for(const value of [...values,p.min]) {
      const base=m.db?10:p.min;
      const index=Math.floor((value-base)/p.step);
      for(const offset of [-1,0,1,2]) {
        const n=base+(index+offset)*p.step;
        if(n>=p.min&&(!m.db||n>=12.5)&&Number.isFinite(n))loads.push(n);
      }
    }
    return unique(loads);
  }
  function floor(value,page={}) {
    value=number(value);if(value==null)return null;
    return rack(page,[value]).filter(n=>n<=value+EPS).at(-1)??null;
  }
  function next(value,page={}) {
    value=number(value);if(value==null)return null;
    return rack(page,[value]).find(n=>n>value+EPS)??null;
  }
  function round(value,current,page={},options={}) {
    value=number(value);current=number(current);
    if(value==null||current==null)return null;
    const upCap=number(options.upCap)??.05,downCap=number(options.downCap)??.05;
    if(Math.abs(value-current)<=EPS)return current;
    const up=value>current,low=up?current:Math.max(0,current*(1-downCap)),high=up?current*(1+upCap):current;
    const loads=rack(page,[value,current,low,high]);
    const candidates=loads.filter(n=>n>=low-EPS&&n<=high+EPS);
    if(!up&&!candidates.some(n=>n<current-EPS)) {
      // A miss may require one coarse reduction beyond the percentage cap.
      return loads.filter(n=>n<current-EPS).at(-1)??current;
    }
    candidates.push(current); // A manually logged actual always remains a hold option.
    candidates.sort((a,b)=>Math.abs(a-value)-Math.abs(b-value)||a-b);
    return candidates[0];
  }
  function starter(page={}) {
    const m=metadata(page),unknown=reason=>({kg:null,confidence:'unknown',reason});
    if(page.loadUnit!=='kg')return unknown('unsupported_unit');
    let desired=null;
    const title=String(page.title||'').trim();
    if(m.bar) {
      if(!/\b(bench|press|squat|deadlift|row)\b/i.test(title))return unknown('unknown_exercise');
      desired=m.plates?0:m.declared;
    } else if(m.db&&m.convention==='single'&&/\bgoblet squat\b/i.test(title))desired=6;
    else if(m.db&&m.convention==='per_hand') {
      if(/\blateral raise\b/i.test(title))desired=2;
      else if(/\bcurl\b/i.test(title))desired=4;
      else if(/\bbench press\b/i.test(title))desired=5;
      else if(/\boverhead press\b/i.test(title))desired=4;
      else if(/\brow\b/i.test(title))desired=6;
    }
    if(desired==null)return unknown('unsupported_equipment_convention_or_exercise');
    const p=profile(page),kg=floor(Math.max(desired,p.min),page);
    if(kg==null)return unknown('no_available_load');
    return {kg,confidence:'provisional',reason:VERSION+':provisional_exercise_default'};
  }
  function label(page={},kg) {
    if(kg==null||kg==='')return '';
    const n=number(kg);if(n==null)return '';
    const m=metadata(page);
    return m.bar&&n===(m.plates?0:m.declared)?'empty bar':String(n);
  }
  root.StrengthEquipment={profile,floor,next,round,starter,label};
})(typeof window!=='undefined'?window:globalThis);
