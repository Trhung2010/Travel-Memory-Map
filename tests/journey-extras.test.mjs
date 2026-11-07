import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJourneyState} from '../src/journey/validation.ts';
import {validateBackupManifest} from '../src/journey/backupFormat.ts';

const trip={id:'trip',title:'Huế',destination:'Huế',description:'',startDate:'2026-11-01',endDate:'2026-11-07',status:'active',
  itinerary:[{id:'stop',date:'2026-11-02',time:'09:30',place:'Đại Nội',visited:true}]};
const memory={id:'memory',tripId:'trip',kind:'note',title:'Một ngày',note:'',createdAt:'2026-11-02T10:00:00Z',
  favorite:true,tags:['Phong cảnh'],deletedAt:'2026-11-03T10:00:00Z'};

test('storage preserves trash, labels, favorites and itinerary',()=>{
  const result=parseJourneyState(JSON.stringify({trips:[trip],memories:[memory]}));
  assert.deepEqual(result.memories[0],memory);
  assert.deepEqual(result.trips[0].itinerary,trip.itinerary);
});

test('old storage remains readable without new fields',()=>{
  const {favorite,tags,deletedAt,...oldMemory}=memory;
  const {itinerary,...oldTrip}=trip;
  assert.equal(parseJourneyState(JSON.stringify({trips:[oldTrip],memories:[oldMemory]})).memories.length,1);
});

test('location traces survive restart and require valid coordinates',()=>{
  const trace={latitude:16.46,longitude:107.59,message:'Quay lại đây'};
  const read=value=>parseJourneyState(JSON.stringify({trips:[{...trip,trace:value}],memories:[]}));
  assert.deepEqual(read(trace).trips[0].trace,trace);
  assert.throws(()=>read({...trace,latitude:91}));
  assert.throws(()=>read({...trace,message:' '}));
});

test('rejects invalid tags and itinerary before they reach the UI',()=>{
  assert.throws(()=>parseJourneyState(JSON.stringify({trips:[trip],memories:[{...memory,tags:[42]}]})));
  assert.throws(()=>parseJourneyState(JSON.stringify({trips:[{...trip,itinerary:[{...trip.itinerary[0],time:'29:00'}]}],memories:[memory]})));
  assert.throws(()=>validateBackupManifest({format:'travel-memory-map',version:2,exportedAt:new Date().toISOString(),trip,memories:[{...memory,favorite:'yes'}],assets:[]}));
});

test('rejects duplicate stops, out-of-trip stops and reversed trip dates',()=>{
  for(const invalid of [
    {...trip,itinerary:[trip.itinerary[0],trip.itinerary[0]]},
    {...trip,itinerary:[{...trip.itinerary[0],date:'2026-11-08'}]},
    {...trip,endDate:'2026-10-30'},
  ])assert.throws(()=>parseJourneyState(JSON.stringify({trips:[invalid],memories:[memory]})));
});

test('rejects invalid stored file URI, duration and creation date',()=>{
  for(const changes of [{uri:42},{durationMs:-1},{createdAt:'invalid'},{note:'x'.repeat(1001)}]){
    assert.throws(()=>parseJourneyState(JSON.stringify({trips:[trip],memories:[{...memory,...changes}]})));
  }
});
