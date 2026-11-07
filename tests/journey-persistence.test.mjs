import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyStore} from '../src/journey/persistence.ts';

const trip={id:'t',title:'Huế',destination:'Huế',description:'',startDate:'2026-11-01',endDate:'2026-11-07',status:'active'};
const memory={id:'m',tripId:'t',kind:'photo',title:'Ảnh',note:'',createdAt:'2026-11-02',uri:'file:///photo.jpg'};
const initial=()=>({trips:[{...trip}],memories:[{...memory}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function setup(write=async()=>{}){
  const writes=[],removed=[],errors=[];
  const store=createJourneyStore(initial(),{write:async raw=>{writes.push(JSON.parse(raw));await write(raw);},remove:uri=>removed.push(uri),onChange:()=>{},onError:error=>errors.push(error)});
  return {store,writes,removed,errors};
}
test('rapid edits are serialized without losing earlier updates',async()=>{
  const {store,writes}=setup();
  store.mutate(s=>({...s,memories:s.memories.map(m=>({...m,favorite:true}))}));
  store.mutate(s=>({...s,memories:s.memories.map(m=>({...m,tags:['Huế']}))}));
  await store.flush();
  assert.equal(writes.length,2);assert.equal(writes[1].memories[0].favorite,true);assert.deepEqual(writes[1].memories[0].tags,['Huế']);
});
test('trash and restore keep media bytes; purge waits for durable metadata',async()=>{
  const gate=deferred();const {store,removed}=setup(()=>gate.promise);
  store.mutate(s=>({...s,memories:s.memories.map(m=>({...m,deletedAt:'2026-11-04'}))}));
  store.mutate(s=>({...s,memories:s.memories.map(m=>({...m,deletedAt:undefined}))}));
  store.mutate(s=>({...s,memories:[]}));
  await Promise.resolve();assert.deepEqual(removed,[]);
  gate.resolve();await store.flush();assert.deepEqual(removed,[memory.uri]);
});
test('failed write stops queued writes and never deletes media',async()=>{
  const {store,writes,removed,errors}=setup(async()=>{throw new Error('disk full');});
  store.mutate(s=>({...s,memories:[]}));
  store.mutate(s=>({...s,trips:[]}));
  await assert.rejects(store.flush(),/disk full/);
  assert.equal(writes.length,1);assert.equal(errors.length,1);assert.deepEqual(removed,[]);
  assert.throws(()=>store.mutate(s=>s),/tạm dừng/);
});
test('import waits for pending writes and rejects concurrent mutations and imports',async()=>{
  const gate=deferred();const {store,writes}=setup(()=>gate.promise);
  store.mutate(s=>({...s,memories:s.memories.map(m=>({...m,favorite:true}))}));
  const task=store.import(s=>({...s,trips:[...s.trips,{...trip,id:'copy'}]}));
  assert.throws(()=>store.mutate(s=>s),/Đang khôi phục/);
  await assert.rejects(store.import(s=>s),/Đang khôi phục/);
  assert.equal(store.getState().trips.length,1);
  gate.resolve();await task;
  assert.equal(writes.length,2);assert.equal(store.getState().trips.length,2);assert.equal(store.getState().memories[0].favorite,true);
});
test('failed import never publishes imported metadata or deletes original files',async()=>{
  const {store,removed}=setup(async()=>{throw new Error('disk full');});
  await assert.rejects(store.import(s=>({...s,trips:[...s.trips,{...trip,id:'copy'}]})),/disk full/);
  assert.equal(store.getState().trips.length,1);assert.deepEqual(removed,[]);
});
test('shared media and cover references survive removal of a memory',async()=>{
  const {store,removed}=setup();
  store.mutate(s=>({...s,trips:[{...trip,coverUri:memory.uri}],memories:[]}));
  await store.flush();assert.deepEqual(removed,[]);
  store.mutate(()=>({trips:[],memories:[]}));await store.flush();assert.deepEqual(removed,[memory.uri]);
});
test('a reattached media reference is not deleted by an older queued write',async()=>{
  const gate=deferred();const {store,removed}=setup(()=>gate.promise);
  store.mutate(s=>({...s,memories:[]}));
  store.mutate(s=>({...s,memories:[memory]}));
  gate.resolve();await store.flush();assert.deepEqual(removed,[]);
});
test('invalid mutation leaves both memory and persistence unchanged',async()=>{
  const {store,writes}=setup();
  assert.throws(()=>store.mutate(s=>({...s,memories:[{...memory,createdAt:'broken'}]})));
  await store.flush();assert.equal(writes.length,0);assert.equal(store.getState().memories[0].createdAt,memory.createdAt);
});

test('orphan cleanup waits for disk writes and rechecks live references',async()=>{
  const gate=deferred();const {store}=setup(()=>gate.promise);let ran=false;
  store.mutate(s=>({...s,memories:s.memories.map(m=>({...m,favorite:true}))}));
  const task=store.cleanup(uris=>{ran=true;assert.deepEqual(uris,[memory.uri]);return 0;});
  await Promise.resolve();assert.equal(ran,false);gate.resolve();assert.equal(await task,0);assert.equal(ran,true);
});
test('orphan cleanup does not run after failed writes',async()=>{
  const {store}=setup(async()=>{throw new Error('disk full');});let ran=false;
  store.mutate(s=>({...s,memories:[]}));
  await assert.rejects(store.cleanup(()=>{ran=true;return 0;}),/disk full/);assert.equal(ran,false);
});
