import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {files,fault,Paths,seed,reset} from './helpers/expo-files.mjs';
registerHooks({resolve(specifier,context,next){
  if(specifier==='expo-file-system')return {url:new URL('./helpers/expo-files.mjs',import.meta.url).href,shortCircuit:true};
  if(context.parentURL?.includes('/src/journey/')&&specifier.startsWith('./')&&!specifier.endsWith('.ts'))return next(specifier+'.ts',context);
  return next(specifier,context);
}});
const {createTripBackup,readTripBackup}=await import('../src/journey/backup.ts');
const {removeOrphanJourneyAssets}=await import('../src/journey/media.ts');
const trip={id:'t',title:'Huế',destination:'Huế',description:'',startDate:'2026-11-01',endDate:'2026-11-07',status:'active',itinerary:[{id:'s',date:'2026-11-02',time:'09:00',place:'Đại Nội',visited:true}]};
const note={id:'n',tripId:'t',kind:'note',title:'Ghi chú',note:'Đi bộ',createdAt:'2026-11-02',favorite:true,tags:['Huế']};
beforeEach(reset);
test('a shareable backup omits private location messages',async()=>{
  const trace={latitude:16,longitude:107,message:'private-trace-sentinel'};
  const output=await createTripBackup({...trip,trace},[note]);
  assert.equal(new TextDecoder().decode(files.get(output.uri).bytes).includes(trace.message),false);
});
test('real backup codec round-trips note-only trips without inventing a cover',async()=>{
  const output=await createTripBackup(trip,[note]);
  const restored=await readTripBackup(output.uri);
  assert.equal(restored.data.trip.coverUri,undefined);
  assert.deepEqual(restored.data.trip.itinerary,trip.itinerary);
  assert.deepEqual(restored.data.memories[0].tags,note.tags);
  assert.equal(restored.data.memories[0].favorite,true);
});
test('chunked backup round-trips media bytes, cover and trash',async()=>{
  const bytes=new Uint8Array(1024*1024+43).map((_,i)=>i%251);
  const uri=seed('file:///documents/TravelMemoryMap/original.jpg',bytes);
  const photo={...note,id:'p',kind:'photo',uri,fileName:'photo.jpg',deletedAt:'2026-11-03'};
  const output=await createTripBackup({...trip,coverUri:uri},[note,photo]);
  const result=await readTripBackup(output.uri);const restored=result.data.memories.find(m=>m.kind==='photo');
  assert.deepEqual(files.get(restored.uri).bytes,bytes);
  assert.equal(result.data.trip.coverUri,restored.uri);assert.equal(restored.deletedAt,photo.deletedAt);
  assert.notEqual(restored.uri,uri);assert.equal(result.createdUris.length,1);
});
test('tampered bytes fail SHA256 and clean all newly restored assets',async()=>{
  const uri=seed('file:///documents/TravelMemoryMap/a.jpg',[1,2,3]);
  const output=await createTripBackup(trip,[{...note,id:'p',kind:'photo',uri,fileName:'a.jpg'}]);
  const bytes=files.get(output.uri).bytes;bytes[bytes.length-1]^=1;
  const before=[...files.keys()];await assert.rejects(readTripBackup(output.uri),/nguyên vẹn/);
  assert.deepEqual([...files.keys()],before);
});
test('truncated archive is rejected before creating restored assets',async()=>{
  const output=await createTripBackup(trip,[note]);const entry=files.get(output.uri);entry.bytes=entry.bytes.slice(0,-1);
  const before=[...files.keys()];await assert.rejects(readTripBackup(output.uri),/cắt mất/);assert.deepEqual([...files.keys()],before);
});
test('low disk space rejects import without partial files',async()=>{
  const output=await createTripBackup(trip,[note]);Paths.availableDiskSpace=0;
  const before=[...files.keys()];await assert.rejects(readTripBackup(output.uri),/dung lượng/);assert.deepEqual([...files.keys()],before);
});
test('export failure closes output before deleting incomplete backup',async()=>{
  fault.write=true;
  await assert.rejects(createTripBackup(trip,[note]),/Injected disk failure/);
  assert.equal(files.size,0);
});
test('cleanup keeps referenced and fresh files and deletes old orphans',()=>{
  const live=seed('file:///documents/TravelMemoryMap/live.jpg',[1]);
  const fresh=seed('file:///documents/TravelMemoryMap/fresh.jpg',[2]);
  const old=seed('file:///documents/TravelMemoryMap/old.jpg',[3]);
  files.get(live).modified=Date.now()-7200000;files.get(old).modified=Date.now()-7200000;
  assert.equal(removeOrphanJourneyAssets([live]),1);assert.equal(files.has(live),true);assert.equal(files.has(fresh),true);assert.equal(files.has(old),false);
});
