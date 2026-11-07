import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTripStatus,isValidLocalDate,parseCoordinates,parseJourneyState,validateTripDraft} from '../src/journey/validation.ts';

const validDraft={title:' Đà Lạt ',destination:' Lâm Đồng ',description:' Cuối tuần ',startDate:'2026-11-04',endDate:'2026-11-06'};

test('validates real calendar dates instead of normalized JavaScript dates',()=>{
  assert.equal(isValidLocalDate('2028-02-29'),true);
  assert.equal(isValidLocalDate('2026-02-29'),false);
  assert.equal(isValidLocalDate('2026-02-31'),false);
  assert.equal(isValidLocalDate('04-11-2026'),false);
});

test('normalizes a valid trip draft',()=>{
  assert.deepEqual(validateTripDraft(validDraft),{...validDraft,title:'Đà Lạt',destination:'Lâm Đồng',description:'Cuối tuần'});
});

test('rejects missing fields and reversed ranges',()=>{
  assert.throws(()=>validateTripDraft({...validDraft,title:' '}),/bắt buộc/);
  assert.throws(()=>validateTripDraft({...validDraft,startDate:'2026-11-07'}),/kết thúc/);
});

test('derives status at the date boundaries',()=>{
  assert.equal(deriveTripStatus('2026-11-04','2026-11-06','2026-11-03'),'upcoming');
  assert.equal(deriveTripStatus('2026-11-04','2026-11-06','2026-11-04'),'active');
  assert.equal(deriveTripStatus('2026-11-04','2026-11-06','2026-11-07'),'completed');
});

test('validates coordinate pairs and geographic bounds',()=>{
  assert.deepEqual(parseCoordinates('',''),{});
  assert.deepEqual(parseCoordinates(' 16.0471 ','108.2068'),{latitude:16.0471,longitude:108.2068});
  assert.throws(()=>parseCoordinates('16.0471',''),/đủ cả/);
  assert.throws(()=>parseCoordinates('91','108'),/Vĩ độ/);
  assert.throws(()=>parseCoordinates('16','181'),/Kinh độ/);
});

test('parses valid storage and refreshes stale trip status',()=>{
  const state=parseJourneyState(JSON.stringify({trips:[{id:'trip-1',title:'Huế',destination:'Huế',description:'',startDate:'2020-01-01',endDate:'2020-01-02',status:'active'}],memories:[]}));
  assert.equal(state.trips[0].status,'completed');
});

test('rejects corrupt storage instead of silently replacing it',()=>{
  assert.throws(()=>parseJourneyState('{broken'),SyntaxError);
  assert.throws(()=>parseJourneyState(JSON.stringify({trips:[{id:'bad'}],memories:[]})),/không hợp lệ/);
  assert.throws(()=>parseJourneyState(JSON.stringify({trips:[],memories:[{id:'memory-1',tripId:'missing',kind:'photo',title:'',note:'',createdAt:'2026-11-04'}]})),/không còn chuyến đi/);
  const trip={id:'trip-1',title:'Huế',destination:'Huế',description:'',startDate:'2026-11-01',endDate:'2026-11-02',status:'completed'};
  assert.throws(()=>parseJourneyState(JSON.stringify({trips:[trip,trip],memories:[]})),/bị trùng/);
  assert.throws(()=>parseJourneyState(JSON.stringify({trips:[trip],memories:[{id:'memory-1',tripId:'trip-1',kind:'note',title:'Sai tọa độ',note:'',createdAt:'2026-11-04',latitude:999,longitude:108}]})),/không hợp lệ/);
});

