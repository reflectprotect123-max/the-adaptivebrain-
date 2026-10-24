import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){const c={console};c.window=c;c.globalThis=c;vm.createContext(c);for(const f of ['training-core.js','coach-loop.js','coach-bridge.js','builder/host.js','builder/strength-targets.js','builder/library.js','builder/library-ui.js'])vm.runInContext(readFileSync(new URL(f,import.meta.url),'utf8'),c);return c;}
const json=x=>JSON.parse(JSON.stringify(x));
test('imported builder migrates old sessions and preserves doses, IDs, history, metrics and engine blocks',()=>{
 const c=fixture(),L=c.CoachLoop;
 const t=L.makeTemplate({name:'Existing',blocks:[{superset:true,notes:'Brace first',exercises:[{id:'squat',name:'Back Squat',sets:4,reps:'10, 8, 6, AMRAP',load:'100',tempo:'33X1',metric:'Weight'}]},{exercises:[{id:'row',name:'DB Row',sets:3,reps:'6-8',load:'20',loadConvention:'per_hand'}]},{type:'text',heading:'Prep',notes:'Keep instructions'},{type:'conditioning',modality:'Bike'}]});
 const engine=json(t.blocks.at(-1)),s=L.instantiateSession(t,{athleteId:'a',date:'2026-10-18'}),frozen=JSON.stringify(s);
 const d=c.CoachBuilder.toBuilder(t);assert.equal(d.blocks[0].setTargets.at(-1).loadRule.kind,'first_working_set');assert.equal(d.blocks[1].groupId,d.blocks[0].groupId);
 assert.ok(d.blocks[0].notes.includes('Brace first'));assert.ok(d.blocks[0].notes.includes('Coach load: 100'));
 assert.equal(d.blocks[1].columns[0],'reps_range');assert.equal(d.blocks[2].instructions,'Keep instructions');
 c.CoachBuilder.applyBuilder(t,d,L);assert.equal(t.blocks[0].exercises[0].load,'100');assert.equal(t.blocks[0].tempo,'33X1');assert.equal(t.blocks[1].exercises[0].loadConvention,'per_hand');assert.deepEqual(json(t.blocks.at(-1)),engine);assert.equal(JSON.stringify(s),frozen);
 const round=c.CoachBuilder.toBuilder(t);assert.deepEqual(json(round.blocks.map(b=>b.setTargets)),json(d.blocks.map(b=>b.setTargets)));
});
test('new APK prescription survives Coach calendar, publishing, bridge and compilation',()=>{
 const c=fixture(),h=c.CoachBuilderHost,L=c.CoachLoop;let st=h.HybridLibrary.createTemplate(h.HybridLibrary.emptyState(),{title:'Imported session'}),id=st.templates[0].id;
 st=h.HybridLibrary.addExercise(st,id,{title:'Back Squat',columns:['reps_range','weight_kg'],setCount:4});const b=st.templates[0].blocks.at(-1);
 b.tempo='20X1';b.setTargets=[10,8,6,null].map((r,i)=>({id:'target'+i,purpose:r?'working':'amrap',reps:r?{min:r,max:r}:null,toFailure:!r,loadRule:{kind:r?'adaptive':'first_working_set'}}));
 const t={id,name:'',blocks:[]};c.CoachBuilder.applyBuilder(t,st.templates[0],L);
 const state={templates:[t],sessions:[]};const s=L.addCalendarSession(state,{templateId:id,athleteId:'a',date:'2026-10-19'});L.publishSession(s);
 const payload=c.CoachBridge.sessionForAthlete(s,'athlete@example.test');const lift=payload.blocks.at(-1);assert.equal(lift.kind,'lift');assert.equal(lift.tempo,'20X1');assert.equal(lift.exercises[0].id,lift.id);assert.equal(lift.setTargets.at(-1).purpose,'amrap');assert.deepEqual(json(lift.columns),['reps_range','weight_kg']);
 c.StrengthTargets=h.StrengthTargets;
 for(const f of ['fixtures/athlete-strength-only.js','fixtures/athlete-coach-assignments.js'])vm.runInContext(readFileSync(new URL(f,import.meta.url),'utf8'),c);
 const received=c.CoachAssignments.convert({id:'published-assignment',scheduled_date:s.date,resolved_snapshot:{htmlSession:payload}});
 const receivedLift=received.blocks.find(b=>b.title==='Back Squat');assert.equal(receivedLift.coachExerciseId,lift.id);assert.equal(receivedLift.tempo,'20X1');
 const compiled=h.HybridLibrary.compile(received);const played=compiled.blocks.find(b=>b.title==='Back Squat');assert.equal(played.setTargets.length,4);assert.equal(played.tempo,'20X1');assert.equal(state.sessions.length,1);assert.equal(L.addCalendarSession(state,{templateId:id,athleteId:'a',date:s.date}),null);
});
test('applyBuilder publishes rest, ramp, percent, catalogue and groupId for the athlete app',()=>{
 const c=fixture(),h=c.CoachBuilderHost,L=c.CoachLoop;
 let st=h.HybridLibrary.createTemplate(h.HybridLibrary.emptyState(),{title:'Ibex'});
 const id=st.templates[0].id;
 st=h.HybridLibrary.addExercise(st,id,{title:'Incline Bench',columns:['reps','weight_kg']});
 const a=st.templates[0].blocks.at(-1);
 a.restSec=90;a.rampCount=2;a.pctLow=63;a.pctHigh=68;a.percentMode='straight';a.exerciseId='cat_bench';
 st=h.HybridLibrary.addExercise(st,id,{title:'Deficit Back Rack Lunge',columns:['reps','weight_kg']});
 st=h.HybridLibrary.linkSuperset(st,id,a.id,st.templates[0].blocks.at(-1).id);
 const t={id,name:'',blocks:[]};c.CoachBuilder.applyBuilder(t,st.templates[0],L);
 const state={templates:[t],sessions:[]};const s=L.addCalendarSession(state,{templateId:id,athleteId:'a',date:'2026-10-24'});L.publishSession(s);
 const payload=c.CoachBridge.sessionForAthlete(s,'athlete@example.test');
 const lift=payload.blocks[0],ex=lift.exercises[0];
 assert.equal(ex.restSec,90);assert.equal(ex.restSeconds,90);assert.equal(ex.rampCount,2);assert.equal(ex.percentMode,'straight');
 assert.equal(ex.exerciseId,'cat_bench');assert.equal(lift.groupId,payload.blocks[1].groupId);
});

test('Coach and APK state namespaces remain separate and all metric options survive',()=>{
 const c=fixture();assert.equal(c.HybridLibrary,undefined);assert.ok(c.CoachBuilderHost.HybridLibrary);assert.ok(c.CoachBuilderHost.StrengthTargets);
 for(const metric of c.TrainingCore.definitions||[]){const t={id:'t',name:'Metrics',blocks:[{id:'b',kind:'lift',title:'Test',setCount:3,repTarget:'8',columns:[metric.key]}]};const d=c.CoachBuilder.toBuilder(t);c.CoachBuilder.applyBuilder(t,d,c.CoachLoop);assert.equal(t.blocks[0].columns[0],metric.key);}
});

test('opening an existing template keeps legacy catalogue IDs and saves new catalogue entries',()=>{
 const c=fixture();c.document={getElementById:()=>null};
 for(const f of ['exercise-search-index.js','coach-exercise-catalog.js','exercise-search.js'])vm.runInContext(readFileSync(new URL(f,import.meta.url),'utf8'),c);
 const state=c.CoachLoop.mergeExerciseCatalog(c.CoachLoop.buildSeed()),t=state.templates[0],before=t.blocks.flatMap(b=>b.exercises||[]).map(e=>e.exerciseId);
 c.CoachBuilder.init({state:()=>state,template:id=>state.templates.find(t=>t.id===id),persist(){}});c.CoachBuilder.mount(t.id,'lifts');
 c.CoachBuilderHost.LibraryView.patchTpl({title:'Renamed existing'});
 assert.deepEqual(t.blocks.flatMap(b=>b.exercises||[]).map(e=>e.exerciseId),before);
 const h=c.CoachBuilderHost;h.S.library=h.HybridLibrary.createCatalogExercise(h.S.library,{title:'My new lift',columns:['reps','weight_kg']});h.save();
 assert.equal(state.builderCatalog.exercises.length,1);c.CoachBuilder.reset();c.CoachBuilder.mount(t.id,'lifts');assert.ok(h.S.library.catalog.exercises.some(e=>e.title==='My new lift'));
 assert.equal(h.HybridLibrary.searchCatalog(h.S.library,'exercises','Back Squat').filter(e=>e.title==='Back Squat').length,1);
});
