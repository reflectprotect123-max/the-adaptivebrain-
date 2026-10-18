import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const rows=[];let saved=0;
const sandbox={console,crypto:{randomUUID:()=> 'new-id'},CoachLoop:{saveState(){saved++;}},Whoop:{client:()=>sb}};
sandbox.globalThis=sandbox;
const sb={auth:{getSession:async()=>({data:{session:{user:{id:'athlete'}}}})},from(){
 let filters=[],action='read',body;
 const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,vs){filters.push(r=>vs.includes(r[k]));return q},
 update(v){action='update';body=v;return q},insert(v){action='insert';body=v;return q},
 async single(){const r=await run();return {data:r.data[0],error:r.data.length===1?null:new Error('Expected exactly one row')}},
 async maybeSingle(){const r=await run();return {data:r.data[0]||null}},then(a,b){return run().then(a,b)}};
 async function run(){let found=rows.filter(r=>filters.every(f=>f(r)));if(action==='insert'){rows.push(structuredClone(body));found=[rows.at(-1)];}
 if(action==='update')for(const row of found){if(row.state!=='draft'&&('published_at'in body||'resolved_snapshot'in body))throw new Error('Freeze violated');Object.assign(row,body);}
 return {data:structuredClone(found)};}return q;
}};
vm.runInNewContext(readFileSync(new URL('./coach-cloud.js',import.meta.url),'utf8'),sandbox);
const s={id:'ses',athleteId:'a',date:'2026-10-18',name:'Squat',published:true,publishedAt:'2026-10-18T00:00:00Z',blocks:[]};
const state={athletes:[{id:'a',cloudUserId:'athlete'}],sessions:[s]};
assert.equal((await sandbox.CoachCloud.pushPublished(state)).ok,true);
assert.equal(rows.length,1);rows[0].id='canonical-id';s.cloudAssignedId='stale-id';
assert.equal((await sandbox.CoachCloud.pushPublished(state)).ok,true);
assert.equal(s.cloudAssignedId,'canonical-id');assert.ok(saved>=2);
s.date='2026-10-19';assert.equal((await sandbox.CoachCloud.pushPublished(state)).ok,true);assert.equal(rows[0].scheduled_date,'2026-10-19');
assert.equal((await sandbox.CoachCloud.unpublishSession(state,s)).ok,true);
assert.equal(rows[0].state,'unpublished');
s.published=true;s.blocks=[{title:'Changed'}];
assert.equal((await sandbox.CoachCloud.pushPublished(state)).ok,false);
assert.equal(rows[0].state,'unpublished');
rows[0].athlete_result={completedAt:'today',sets:[],estimates:[]};s.cloudAssignedId='stale-again';
assert.equal((await sandbox.CoachCloud.refreshPublishedStates(state)).updated,1);
assert.equal(s.status,'completed');assert.equal(s.cloudAssignedId,'canonical-id');
rows.length=0;assert.equal((await sandbox.CoachCloud.unpublishSession(state,s)).ok,false);
console.log('coach-delivery: identity recovery, idempotent freeze, changed-content rejection, results, zero-row failure passed');
