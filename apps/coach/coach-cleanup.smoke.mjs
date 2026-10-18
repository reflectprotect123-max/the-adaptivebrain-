import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = n => readFileSync(new URL(n, import.meta.url), 'utf8');
function context(files) {
  const c = { console }; c.window = c; c.globalThis = c; vm.createContext(c);
  for (const n of files) vm.runInContext(source(n), c);
  return c;
}
const catalogFiles = ['exercise-search-index.js','coach-exercise-catalog.js','exercise-search.js','coach-loop.js'];

test('search and builder share one canonical dataset while old IDs still resolve', () => {
  const c = context(catalogFiles);
  assert.equal(c.COACH_EXERCISE_CATALOG, c.EXERCISE_SEARCH_INDEX);
  const hits = c.ExerciseSearch.search('back squat', 12).filter(x => x.name === 'Back Squat');
  assert.equal(hits.length, 1);
  const canonicalRdl = c.COACH_EXERCISE_CATALOG.find(x=>x.source==='supabase-exercise-catalogue' && x.name==='Romanian Deadlift');
  assert.ok(canonicalRdl.aliases.includes('rdls'), 'legacy RDLs shorthand transfers to its visible canonical choice');
  assert.ok(c.ExerciseSearch.byId('core-back-squat'));
  assert.ok(c.ExerciseSearch.byId('exercise_1ac603ef245264c6'));
  assert.equal(c.ExerciseSearch.search('Horse Stance Pulse', 10).filter(x=>x.name==='Horse Stance Pulse').length, 2);
  const visible = c.ExerciseSearch.visibleEntries(c.COACH_EXERCISE_CATALOG);
  assert.equal(visible.filter(x=>x.name==='Back Squat').length, 1);
  assert.equal(visible.filter(x=>x.catalogue==='banded').length, 153);
});

test('compact saves migrate full legacy catalogues without losing custom data, metadata or history', () => {
  const c = context(catalogFiles), L = c.CoachLoop, store = L.memoryStorage();
  const s = L.mergeExerciseCatalog(L.buildSeed());
  s.exercises.push({id:'custom-1',name:'My lift',builtIn:false,notes:'keep'});
  s.exercises.find(x=>x.id==='core-back-squat').customNote='my rack';
  s.liftMemory={ athlete:{'back squat':{exerciseId:'core-back-squat',e1rmKg:140,lastKg:100}} };
  const full = JSON.stringify(s);
  // Reproduce an existing installation with its full v1 saved catalogue.
  store.setItem('THE-coach-loop-v1', full);
  const old = L.loadState(store); L.saveState(store, old);
  const packed = JSON.parse(store.getItem('THE-coach-loop-v1'));
  assert.ok(JSON.stringify(packed).length < full.length / 3);
  assert.ok(packed.exercises.some(x=>x.id==='custom-1'));
  assert.ok(packed.exercises.some(x=>x.customNote==='my rack'));
  assert.ok(!packed.exercises.some(x=>x.id==='core-barbell-curl'));
  const restored = L.loadState(store);
  assert.equal(restored.exercises.length, s.exercises.length);
  assert.equal(JSON.stringify(restored.liftMemory), JSON.stringify(s.liftMemory));
  assert.equal(restored.exercises.find(x=>x.id==='core-back-squat').customNote, 'my rack');
  assert.equal(JSON.stringify(old), full); // Saving must not strip the live editor state.
  assert.ok(restored.exercises.find(x=>x.name==='Couch Stretch').perSide);
});

function cloudFixture() {
  let user='coach-a'; const rows=new Map();
  const counts={reads:0,updates:0,inserts:0,saves:0};
  const client={auth:{getSession:async()=>({data:{session:user?{user:{id:user}}:null}})},from(){
    const eq={}; let operation='read', value;
    return {select(){return this;},eq(k,v){eq[k]=v;return this;},
      update(v){operation='update';value=v;return this;},insert(v){operation='insert';value=v;return this;},
      async maybeSingle(){counts.reads++;return {data:[...rows.values()].find(r=>Object.entries(eq).every(([k,v])=>r[k]===v))||null};},
      async single(){
        if(operation==='update'){counts.updates++;const old=[...rows.values()].find(r=>Object.entries(eq).every(([k,v])=>r[k]===v));if(!old)return {error:{message:'missing'}};Object.assign(old,value);return {data:{id:old.id}};}
        counts.inserts++; rows.set(value.id,structuredClone(value));return {data:{id:value.id}};
      }};
  }};
  const c={console,Whoop:{client:()=>client},CoachLoop:{saveState:()=>{counts.saves++;}},CoachBridge:{sessionForAthlete:s=>({id:s.id,name:s.name})}};
  c.globalThis=c;vm.createContext(c);vm.runInContext(source('coach-cloud.js'),c);
  const session={id:'s1',athleteId:'a1',name:'Squat day',published:true,date:'2026-10-18',publishedAt:'2026-10-18T00:00:00Z',cloudAssignedId:'assignment-1'};
  const state={athletes:[{id:'a1',cloudUserId:'athlete-1'}],sessions:[session]};
  rows.set('assignment-1',{id:'assignment-1',athlete_id:'athlete-1',coach_session_key:'s1',state:'published',scheduled_date:session.date,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,resolved_snapshot:{v:1,writer:'html-coach',coachSessionId:'s1',htmlSession:{id:'s1',name:'Squat day'}}});
  return {cloud:c.CoachCloud,state,session,rows,counts,setUser:u=>{user=u;}};
}

test('unchanged auto-publishing avoids updates, then skips repeat reads; cache is account scoped',async()=>{
  const f=cloudFixture();
  assert.equal((await f.cloud.pushPublished(f.state,{skipUnchanged:true})).ok,true);
  assert.equal(f.counts.reads,1);assert.equal(f.counts.updates,0);assert.equal(f.counts.saves,0);
  await f.cloud.pushPublished(f.state,{skipUnchanged:true});assert.equal(f.counts.reads,1);
  f.setUser('coach-b');await f.cloud.pushPublished(f.state,{skipUnchanged:true});assert.equal(f.counts.reads,2);
});

test('date edits publish, manual re-publish reconciles and frozen prescriptions stay frozen',async()=>{
  const f=cloudFixture();await f.cloud.pushPublished(f.state,{skipUnchanged:true});
  f.session.date='2026-10-19';await f.cloud.pushPublished(f.state,{skipUnchanged:true});assert.equal(f.counts.updates,1);
  f.rows.get('assignment-1').state='unpublished';
  await f.cloud.pushPublished(f.state);assert.equal(f.rows.get('assignment-1').state,'published');
  f.session.name='Changed frozen prescription';const r=await f.cloud.pushPublished(f.state,{skipUnchanged:true});
  assert.equal(r.ok,false);assert.match(r.errors[0].error,/frozen/);
});

test('completed receipts remain completed and failed requests are retried',async()=>{
  const f=cloudFixture();f.rows.get('assignment-1').state='completed';
  f.rows.get('assignment-1').athlete_result={sets:[{reps:8,kg:100}]};
  await f.cloud.pushPublished(f.state,{skipUnchanged:true});
  assert.equal(f.rows.get('assignment-1').state,'completed');
  assert.equal(f.rows.get('assignment-1').athlete_result.sets[0].kg,100);
  f.session.name='Invalid';assert.equal((await f.cloud.pushPublished(f.state,{skipUnchanged:true})).ok,false);
  assert.equal((await f.cloud.pushPublished(f.state,{skipUnchanged:true})).ok,false);
  f.setUser(null);assert.equal((await f.cloud.pushPublished(f.state,{skipUnchanged:true})).reason,'auth_required');
});

test('new assignment IDs are persisted once per batch and repeated background pushes do no work', async()=>{
  const f=cloudFixture();f.rows.clear();
  f.state.sessions=Array.from({length:20},(_,i)=>({...f.session,id:'new-'+i,cloudAssignedId:undefined}));
  assert.equal((await f.cloud.pushPublished(f.state,{skipUnchanged:true})).pushed,20);
  assert.equal(f.counts.reads,20);assert.equal(f.counts.inserts,20);assert.equal(f.counts.saves,1);
  const again=await f.cloud.pushPublished(f.state,{skipUnchanged:true});
  assert.equal(again.unchanged,20);assert.equal(f.counts.reads,20);assert.equal(f.counts.inserts,20);assert.equal(f.counts.saves,1);
});
