/** Shared training contract. Generated copies in athlete/coach; edit this source. */
(function(root) {
  const efforts=['very_easy','easy','average','hard','max_effort'];
  const rir={easy:6,average:3,medium:3,hard:1,max_effort:0};
  const definitions=[
    ['reps','Reps','integer'],['reps_range','Rep Range','integer'],
    ['weight_lb','Weight (lb)','decimal'],['weight_kg','Weight (kg)','decimal'],
    ['weight_pct','Weight (%)','decimal'],['lwp','Linear Weight Progression','signed'],
    ['time_mmss','Time (mm:ss)','time'],['seconds','Seconds','decimal'],
    ['miles','Miles','decimal'],['yards','Yards','decimal'],['meters','Meters','decimal'],
    ['feet','Feet','decimal'],['watts','Watts','decimal'],['calories','Calories','decimal'],
    ['inches','Inches','decimal'],['velocity','Velocity (m/s)','decimal'],
    ['other','Other','decimal'],['for_completion','For Completion','completion']
  ].map(([key,label,input])=>({key,label,input}));
  const coachKinds=[
    ['reps','Reps','Reps','reps','reps'],['reps_range','Reps (min–max)','Reps','reps','reps','8-12'],
    ['weight_kg','Weight (kg)','Weight','weight','reps'],['weight_pct_wm','Weight % (of WM)','Weight','weight','reps','70'],
    ['weight_lwp','Weight (LWP)','Weight','weight','reps','+2.5'],['time_sec','Time (seconds)','Seconds','reps','seconds','30'],
    ['distance_m','Distance (metres)','Metres','reps','reps','100']
  ].map(([key,label,loggerLabel,field,targetKind,placeholder])=>({key,label,loggerLabel,field,targetKind,...(placeholder?{placeholder}:{})}));
  const aliases={time_sec:'seconds',distance_m:'meters',weight_pct_wm:'weight_pct',weight_lwp:'lwp'};
  const canonical=k=>aliases[k]||k;
  const metric=k=>definitions.find(d=>d.key===canonical(k));
  const effort=k=>k==='medium'?'average':k;
  function repTarget(value) {
    const m=String(value??'').trim().match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
    if(!m)return null;const min=Number(m[1]),max=Number(m[2]||m[1]);
    return Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&min>0&&max>=min?{min,max,text:min===max?String(min):`${min}-${max}`}:null;
  }
  function parse(value,key) {
    if(value==null||String(value).trim()==='')return null;
    const s=String(value).trim(),m=metric(key);
    if(!m)return null;
    if(m.input==='time'&&s.includes(':')){const match=s.match(/^(\d+):([0-5]\d)$/);return match?Number(match[1])*60+Number(match[2]):null;}
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))return null;
    const n=Number(s);return Number.isFinite(n)&&(m.input==='signed'||n>=0)&&(m.input!=='integer'||Number.isInteger(n))?n:null;
  }
  function format(value,key) {
    if(value==null||value==='')return '';
    if(metric(key)?.input==='time'){const n=Math.max(0,Math.round(Number(value)));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
    return String(value);
  }
  function numberEntry(value,{key='reps',range=false}={}) {return {buffer:format(value,key),fresh:true,key,range,error:''};}
  function numberKey(entry,key) {
    if(key==='clear')return {...entry,buffer:'',fresh:false,error:''};
    let s=entry.buffer;const type=metric(entry.key)?.input||'integer';
    if(key==='⌫')s=s.slice(0,-1);
    else if(/^\d$/.test(key))s=(entry.fresh?'':s)+key;
    else if(key==='–'&&entry.range&&/^\d+$/.test(s))s+='-';
    else if(key==='.'&&['decimal','signed'].includes(type)&&!s.includes('.'))s=(entry.fresh?'':s)+'.';
    else if(key===':'&&type==='time'&&/^\d+$/.test(s))s+=':';
    else if(key==='-'&&type==='signed'&&(entry.fresh||s===''))s='-';
    else return entry;
    return {...entry,buffer:s,fresh:false,error:''};
  }
  function keys(entry) {const t=metric(entry.key)?.input;return ['1','2','3','4','5','6','7','8','9',entry.range?'–':t==='time'?':':['decimal','signed'].includes(t)?'.':null,'0','⌫'];}
  function rowValue(row,key) {key=canonical(key);return key==='reps'||key==='reps_range'?row.reps:key==='weight_kg'?row.kg:row.cells?.[key];}
  function validateRow(row,page) {
    if(row.miss)return {ok:true,error:''};
    if(page?.askEffort!==false && !efforts.includes(effort(row.effort)))return {ok:false,error:'Choose an effort or select Did Not Complete.'};
    const columns=page?.columns?.length?page.columns:page?.logMode==='kg'?['reps','weight_kg']:['reps'];
    for(const raw of columns){const key=canonical(raw);if(key==='for_completion')continue;const v=rowValue(row,key),n=parse(v,key);
      if(n==null||(['reps','reps_range'].includes(key)&&n<1))return {ok:false,error:`Enter a valid ${metric(key)?.label||key}.`};
    }
    return {ok:true,error:''};
  }
  function migrateSession(session) {
    if(!session||session.metricContractVersion===1)return session;
    for(const outer of session.pages||[])for(const page of outer.members||[outer]) {
      page.columns=(page.columns||[]).map(canonical);
      const otherLoads=page.columns.filter(k=>['weight_lb','weight_pct','lwp'].includes(k));
      if(page.columns.includes('weight_lb'))page.loadUnit='lb';
      for(const row of session.logs?.[page.id]?.sets||[]) {
        row.cells=row.cells||{};
        for(const [old,key] of Object.entries(aliases))if(row.cells[old]!=null&&row.cells[key]==null)row.cells[key]=row.cells[old];
        // Older generic logger put these values in the kg slot. Move only unambiguous records.
        if(otherLoads.length===1&&!page.columns.includes('weight_kg')&&row.cells[otherLoads[0]]==null&&row.kg!=null){row.cells[otherLoads[0]]=row.kg;row.kg=null;}
      }
    }
    session.metricContractVersion=1;return session;
  }
  root.TrainingCore={definitions,coachKinds,rir,aliases,canonical,metric,efforts,effort,repTarget,parse,format,numberEntry,numberKey,keys,rowValue,validateRow,migrateSession};
})(typeof window!=='undefined'?window:globalThis);
