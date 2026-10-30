import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){const c={console};c.window=c;c.globalThis=c;vm.createContext(c);for(const f of ['training-core.js','coach-loop.js','coach-bridge.js','builder/host.js','builder/strength-targets.js','builder/library.js','builder/library-ui.js'])vm.runInContext(readFileSync(new URL(f,import.meta.url),'utf8'),c);return c;}
const json=x=>JSON.parse(JSON.stringify(x));
const PCT=[65,68,70,72];
const targets=pcts=>pcts.map(pct=>({purpose:'working',reps:{min:6,max:6},loadRule:{kind:'adaptive'},toFailure:false,pct}));

test('StrengthTargets keeps per-set pct and rejects values outside 0-110',()=>{
 const T=fixture().CoachBuilderHost.StrengthTargets;
 assert.deepEqual(json(T.normalize({id:'dl',setTargets:targets(PCT)}).map(t=>t.pct)),PCT);
 assert.deepEqual(json(T.normalize({id:'dl',setTargets:targets(['70%'])}).map(t=>t.pct)),[70]);
 assert.deepEqual(json(T.normalize({id:'dl',setCount:2,repTarget:'5',setPct:[60,65]}).map(t=>t.pct)),[60,65]);
 assert.equal(T.normalize({id:'dl',setCount:1,repTarget:'5'})[0].pct,undefined);
 for(const bad of [0,-5,111,Number.NaN])assert.throws(()=>T.normalize({id:'dl',setTargets:targets([bad])}),/between 0 and 110/);
});

test('per-set pct survives builder patch, publish conversion, bridge and the athlete import',()=>{
 const c=fixture(),h=c.CoachBuilderHost,L=c.CoachLoop;let st=h.HybridLibrary.createTemplate(h.HybridLibrary.emptyState(),{title:'Pct'}),id=st.templates[0].id;
 st=h.HybridLibrary.addExercise(st,id,{title:'Deadlift',columns:['reps','weight_pct'],setCount:4});const bid=st.templates[0].blocks.at(-1).id;
 st=h.HybridLibrary.patchBlock(st,id,bid,{setTargets:targets(PCT)});
 assert.deepEqual(json(st.templates[0].blocks.at(-1).setTargets.map(t=>t.pct)),PCT);
 const t={id,name:'',blocks:[]};c.CoachBuilder.applyBuilder(t,st.templates[0],L);
 const ex=t.blocks.find(b=>b.heading==='Deadlift').exercises[0];
 assert.deepEqual(json(ex.setTargets.map(x=>x.pct)),PCT);
 assert.deepEqual(json(ex.logColumns.find(x=>x.kind==='weight_pct').values),PCT.map(String));
 assert.deepEqual(json(c.CoachBuilder.toBuilder(t).blocks.find(b=>b.title==='Deadlift').setTargets.map(x=>x.pct)),PCT);
 const state={templates:[t],sessions:[]};const s=L.addCalendarSession(state,{templateId:id,athleteId:'a',date:'2026-10-30'});L.publishSession(s);
 const payload=c.CoachBridge.sessionForAthlete(s,'athlete@example.test');
 c.StrengthTargets=h.StrengthTargets;
 for(const f of ['fixtures/athlete-strength-only.js','fixtures/athlete-coach-assignments.js'])vm.runInContext(readFileSync(new URL(f,import.meta.url),'utf8'),c);
 const got=c.CoachAssignments.convert({id:'pct-assignment',scheduled_date:s.date,resolved_snapshot:{htmlSession:payload}}).blocks.find(b=>b.title==='Deadlift');
 assert.deepEqual(json(got.setTargets.map(x=>x.pct)),PCT);
});

test('legacy Weight % column values become per-set pct when opened in the builder',()=>{
 const c=fixture();
 const t={id:'t',name:'Legacy',blocks:[{exercises:[{id:'dl',name:'Deadlift',sets:4,reps:'6',logColumns:[{kind:'reps'},{kind:'weight_pct',values:['65','68%','70','72']}]}]}]};
 const d=c.CoachBuilder.toBuilder(t);assert.deepEqual(json(d.blocks[0].setTargets.map(x=>x.pct)),PCT);
 c.CoachBuilder.applyBuilder(t,d,c.CoachLoop);assert.deepEqual(json(t.blocks[0].exercises[0].logColumns.find(x=>x.kind==='weight_pct').values),PCT.map(String));
});
