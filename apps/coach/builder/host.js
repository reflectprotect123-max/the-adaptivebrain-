/** Coach integration for the APK builder exported from strengthside@5551ef5a.
 * The imported view/model run in a separate host, never in Coach's state namespace.
 */
(function(root) {
  const clone = x => JSON.parse(JSON.stringify(x));
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases = {time_sec:'seconds',distance_m:'meters',weight_pct_wm:'weight_pct',weight_lwp:'lwp'};
  function columns(ex) {
    const keys = (ex.columns || ex.logColumns || []).map(c => typeof c === 'string' ? c : c.kind).filter(Boolean).map(k=>aliases[k]||k);
    if(keys.length) return keys;
    if (/second/i.test(ex.metric||'')) return ['seconds'];
    if (/metre|meter/i.test(ex.metric||'')) return ['meters'];
    return [/[–-]/.test(ex.reps||'') ? 'reps_range' : 'reps', ...(/weight/i.test(ex.metric||'Weight')?['weight_kg']:[])];
  }
  function targets(ex) {
    if(ex.setTargets?.length) return clone(ex.setTargets);
    const parts = String(ex.reps || '8').split(/[,/]/).map(s=>s.trim());
    const n = Math.max(1,Number(ex.sets)||3);
    return Array.from({length:n},(_,i)=>{
      const s=parts[i]||parts.at(-1), amrap=/amrap/i.test(s) && i>0;
      const m=s.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
      return {id:`${ex.id}:set:${i+1}`,purpose:amrap?'amrap':'working',reps:amrap?null:{min:Number(m?.[1]||8),max:Number(m?.[2]||m?.[1]||8)},toFailure:amrap,loadRule:{kind:amrap?'first_working_set':'adaptive'}};
    });
  }
  function toBuilder(t) {
    const blocks=[];let previousGroup=null;
    for(const b of t.blocks||[]) {
      if(b.kind==='lift'||b.kind==='circuit') {
        const c=clone(b);delete c.exercises;blocks.push(c);continue;
      }
      if(b.type==='conditioning'||b.type==='recovery') {previousGroup=null;continue;}
      const role=b.role || (b.category==='Warm-Up'?'warmup':b.category==='Cool-Down'?'cooldown':null);
      if(!b.exercises?.length) {
        if(b.notes) blocks.push({id:b.id,kind:'circuit',title:b.heading||'Instructions',instructions:b.notes,role,track:'for_completion'});
        previousGroup=null;continue;
      }
      const groupId=b.superset ? `group:${b.id}` : b.supersetPartner ? previousGroup : null;
      previousGroup=groupId;
      for(const ex of b.exercises) {
        const cols=columns(ex),ts=targets(ex), hasReps=cols.some(k=>k==='reps'||k==='reps_range');
        const notes=[ex.coachNote,b.notes,b.coachNote,b.instructions].flat().filter(Boolean).map(String);
        if(/^(yes|each|per side)$/i.test(ex.perSide||'')) notes.push('Complete the prescription on each side.');
        if(ex.load) notes.push(`Coach load: ${ex.load}`);
        const prescribed=(ex.logColumns||[]).filter(c=>!['reps','reps_range'].includes(aliases[c.kind]||c.kind)).map(c=>(c.values?.length?c.values:[c.value]).filter(v=>v!=null&&v!=='').join(' / ')).filter(Boolean).join(' · ');
        if(ts.some(t=>t.reps&&t.reps.min!==t.reps.max) && cols.includes('reps')) cols[cols.indexOf('reps')]='reps_range';
        blocks.push({...clone(ex),id:ex.id,kind:'lift',title:ex.name,role,groupId:groupId||(b.exercises.length>1?`group:${b.id}`:null),
          setCount:Math.max(1,Number(ex.sets)||3),repTarget:ts[0]?.reps?String(ts[0].reps.min):'8',columns:cols,
          ...(hasReps?{setTargets:ts}:{}),prescribed:hasReps?'':prescribed||String(ex.reps||''),notes,tempo:ex.tempo||'',exerciseId:ex.exerciseId||null});
      }
    }
    return {id:t.id,title:t.name,instructions:t.coachInstructions||'',blocks};
  }
  function applyBuilder(t,draft,L) {
    const old = new Map((t.blocks||[]).flatMap(b=>(b.exercises||[]).map(e=>[e.id,e])));
    const retained=(t.blocks||[]).filter(b=>!b.kind&&(b.type==='conditioning'||b.type==='recovery'));
    t.name=draft.title;t.coachInstructions=draft.instructions||'';
    t.blocks=draft.blocks.map(b=>{
      if(b.kind==='circuit') return {...clone(b),type:'text',heading:b.title,notes:b.instructions||'',exercises:[]};
      const ts=b.setTargets,rep=ts?.length?ts.map(t=>t.purpose==='amrap'?'AMRAP':t.reps.min===t.reps.max?String(t.reps.min):`${t.reps.min}-${t.reps.max}`).join(', '):b.prescribed||b.repTarget;
      const existing=old.get(b.id)||{};
      const ex={...clone(existing),id:b.id,name:b.title,exerciseId:b.exerciseId||'',sets:ts?.length||b.setCount,reps:rep,
        autopilotVolume:false,tempo:b.tempo||'',columns:clone(b.columns||[]),logColumns:(b.columns||[]).map(kind=>({kind})),
        coachNote:(b.notes||[]).join('\n'),setTargets:ts?clone(ts):undefined};
      for(const key of ['equipmentId','loadConvention','exerciseType','minimumKg','barWeightKg','equipmentStepKg','availableLoads','rampCount','restSec','restSeconds','pctLow','pctHigh','percentMode','percentBasis','basisLift','basisReps','oneRm','percent','startPct','rpe','exerciseId','groupId']) if(b[key]!=null) ex[key]=clone(b[key]);
      if(ex.restSec!=null && ex.restSeconds==null) ex.restSeconds=ex.restSec;
      return {...clone(b),type:'strength',heading:b.title,category:b.role==='warmup'?'Warm-Up':b.role==='cooldown'?'Cool-Down':'Strength/Power',
        scoring:b.role?'completion':'weight',rounds:b.setCount,groupId:b.groupId||null,exercises:[ex]};
    });
    // Engine blocks remain byte-for-byte intact; the strength import never rewrites them.
    t.blocks.push(...retained);
    return t;
  }
  const host={S:{},TrainingCore:root.TrainingCore,document:root.document,alert:x=>root.alert(x),confirm:x=>root.confirm(x),today:()=>root.CoachLoop.today()};
  let context=null,currentId=null,knownExercises=new Set(),knownCircuits=new Set();
  function save() {
    const t=context?.template(currentId),d=host.S.library?.templates.find(t=>t.id===currentId);
    if(!t||!d)return;
    applyBuilder(t,d,root.CoachLoop);
    const catalog=host.S.library.catalog;
    context.state().builderCatalog={exercises:catalog.exercises.filter(e=>!knownExercises.has(e.id)),circuits:catalog.circuits.filter(e=>!knownCircuits.has(e.id))};
    context.persist();
  }
  function calendarHtml() {
    const u=host.S.libUi;
    return `<div class="shell-screen shell-screen--library"><div class="lib-head-row"><button class="lib-back" aria-label="Back" onclick="LibraryView.calendarBack()">←</button><h1>Post to calendar</h1></div>
      <div class="lib-field"><label for="coachBuilderAthlete">Athlete</label><select id="coachBuilderAthlete" onchange="CoachBuilderHost.S.libUi.athleteId=this.value">${context.state().athletes.map(a=>`<option value="${esc(a.id)}" ${u.athleteId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div class="lib-field"><label for="sessionPostDate">Date</label><input id="sessionPostDate" type="date" value="${esc(u.date)}" onchange="LibraryView.setDate(this.value)"></div>
      <div class="lib-field"><p>Save this session to the athlete’s calendar. Use Publish there when it is ready to send.</p><button class="lib-primary" onclick="LibraryView.confirmDate()">Post to calendar</button></div></div>`;
  }
  function render() {
    const el=root.document.getElementById('coachImportedBuilder');if(!el)return;
    const u=host.S.libUi;
    el.innerHTML=u.screen==='calendar'?calendarHtml():host.LibraryView.html();
    el.querySelector('.lib-field input:not([type])')?.setAttribute('aria-label','Session title');
    // Source fields save on change; Coach also saves typing before navigating its shell.
    el.querySelectorAll('input[onchange],textarea[onchange]').forEach(input=>{
      if((input.getAttribute('onchange')||'').includes('patchTpl')) input.addEventListener('input',()=>input.dispatchEvent(new Event('change',{bubbles:true})));
    });
  }
  host.save=save;host.render=render;
  function mount(id,step) {
    if(!context)return;
    if(currentId!==id) {
      currentId=id;
      const state=context.state(),t=context.template(id),lib=host.HybridLibrary.emptyState();
      const custom=state.builderCatalog||{};
      const visible=new Set((root.ExerciseSearch?.visibleEntries?.(state.exercises)||state.exercises).map(e=>e.id));
      lib.catalog.exercises=state.exercises.map(ex=>({...clone(ex),title:ex.name,columns:columns(ex),coachHidden:!visible.has(ex.id)}));
      knownExercises=new Set(lib.catalog.exercises.map(e=>e.id));knownCircuits=new Set(lib.catalog.circuits.map(e=>e.id));
      lib.catalog.exercises.push(...(custom.exercises||[]));lib.catalog.circuits.push(...(custom.circuits||[]));
      lib.templates=[toBuilder(t)];host.S={library:lib,libUi:{screen:step==='cooldown'?'cooldown':(step==='lifts'||step==='edit'?'edit':'warmup'),flow:'wizard',tid:id,q:'',selected:[],liftIndex:0}};
    }
    root.LibraryView=host.LibraryView;
    host.LibraryView.goList=()=>{save();context.back();};
    host.LibraryView.calendar=(tid)=>{
      save();Object.assign(host.S.libUi,{screen:'calendar',tid,date:host.S.libUi.date||host.today(),athleteId:host.S.libUi.athleteId||context.state().athletes[0]?.id});render();
    };
    host.LibraryView.confirmDate=()=>{
      const {date,athleteId}=host.S.libUi;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!context.state().athletes.some(a=>a.id===athleteId))return host.alert('Choose an athlete and date.');
      save();const s=root.CoachLoop.addCalendarSession(context.state(),{templateId:currentId,date,athleteId});
      if(!s)return host.alert('This session is already on that athlete’s calendar.');
      context.persist();context.calendar(athleteId,date);
    };
    render();
  }
  root.CoachBuilderHost=host;
  root.CoachBuilder={toBuilder,applyBuilder,init:c=>context=c,mount,reset:()=>{host.LibraryView.resetEditor();currentId=null;},create(){
    const d=host.HybridLibrary.createTemplate(host.HybridLibrary.emptyState(),{title:'New session'}).templates[0];
    const t={id:d.id,name:d.title,coachInstructions:'',blocks:[]};applyBuilder(t,d,root.CoachLoop);return t;
  }};
})(typeof window!=='undefined'?window:globalThis);
