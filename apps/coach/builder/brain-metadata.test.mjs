import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
const ctx=vm.createContext({console});
for(const f of ['../training-core.js','strength-targets.js','library.js'])vm.runInContext(readFileSync(join(dir,f),'utf8'),ctx);
const L=ctx.HybridLibrary;
function block(title,extra={}){let st=L.createTemplate(L.emptyState(),{title:'T'});const tid=st.templates[0].id;st=L.addExercise(st,tid,{title,columns:['reps','weight_kg'],...extra});return st.templates[0].blocks.at(-1);}
test('#2 a typed-in lift resolves its catalogue exerciseId from a normalised title',()=>{
 assert.equal(block('back squat').exerciseId,'ex_back_squat');
 assert.equal(block('  Back  Squat ').exerciseId,'ex_back_squat');
 assert.equal(block('Farmer Carry (each side)').exerciseId,'ex_farmer_carry');
});
test('#2 an unknown typed-in lift gets a stable title key',()=>{
 const a=block('Zercher Good Morning'),b=block('zercher  good-morning');
 assert.equal(a.exerciseId,'title:zercher_good_morning');assert.equal(b.exerciseId,a.exerciseId);
});
const expect={
 'Deadlift':{equipmentId:'barbell',loadConvention:'total',bodyRegion:'lower',exerciseType:'main'},
 'Overhead Press':{equipmentId:'barbell',loadConvention:'total',bodyRegion:'upper',exerciseType:'main'},
 'OHP':{equipmentId:'barbell',loadConvention:'total',bodyRegion:'upper'},
 'Romanian Deadlift':{equipmentId:'barbell',loadConvention:'total',bodyRegion:'lower'},
 'RDL':{equipmentId:'barbell',loadConvention:'total',bodyRegion:'lower'},
 'Hip Thrust':{equipmentId:'barbell',loadConvention:'total',bodyRegion:'lower'},
 'Trap Bar Deadlift':{equipmentId:'barbell',loadConvention:'total',barWeightKg:25,bodyRegion:'lower',exerciseType:'main'},
 'KB Swing':{equipmentId:'kettlebell',loadConvention:'single',bodyRegion:'lower'},
 'Kettlebell RDL':{equipmentId:'kettlebell',loadConvention:'single',bodyRegion:'lower'},
 'Weighted Pull-up':{equipmentId:'bodyweight',loadConvention:'bodyweight',bodyRegion:'upper'},
 'DB RDL':{equipmentId:'dumbbell',loadConvention:'per_hand',bodyRegion:'lower'},
 'Bench Press':{equipmentId:'barbell',bodyRegion:'upper'},
};
for(const [title,want] of Object.entries(expect))test(`#4 ${title} is tagged for the brain`,()=>{
 const b=block(title);for(const [k,v] of Object.entries(want))assert.equal(b[k],v,`${title}.${k}`);
});
test('starting weight survives into the compiled athlete session',()=>{
 let st=L.createTemplate(L.emptyState(),{title:'T'});const tid=st.templates[0].id;
 st=L.addExercise(st,tid,{title:'Back Squat',columns:['reps','weight_kg'],startingKg:60});
 const b=st.templates[0].blocks.at(-1);assert.equal(b.startingKg,60);
 const out=L.compile(st.templates[0]);const lift=out.blocks.find(x=>x.title==='Back Squat');
 assert.equal(lift.startingKg,60);assert.equal(lift.bodyRegion,'lower');assert.equal(lift.exerciseId,'ex_back_squat');
});
