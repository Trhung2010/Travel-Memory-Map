import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKUP_MAGIC,decodeBackupHeader,encodeBackupHeader,validateBackupManifest} from '../src/journey/backupFormat.ts';

const trip={id:'trip-1',title:'Huế',destination:'Huế',description:'',startDate:'2026-11-01',endDate:'2026-11-03',status:'completed'};
const note={id:'memory-note',tripId:'trip-1',kind:'note',title:'Ngày đầu',note:'Đi bộ',createdAt:'2026-11-01T10:00:00.000Z',latitude:16.4637,longitude:107.5909};
const photo={id:'memory-photo',tripId:'trip-1',kind:'photo',title:'Cầu Trường Tiền',note:'',createdAt:'2026-11-01T11:00:00.000Z',fileName:'photo.jpg',mimeType:'image/jpeg'};
const sha256='a'.repeat(64);
const manifest={format:'travel-memory-map',version:2,exportedAt:'2026-11-05T00:00:00.000Z',trip,memories:[note,photo],assets:[{memoryId:'memory-photo',fileName:'photo.jpg',mimeType:'image/jpeg',size:1234,sha256}]};

test('encodes and decodes the versioned backup header',()=>{
  const header=encodeBackupHeader(2048);
  assert.equal(new TextDecoder().decode(header.slice(0,8)),BACKUP_MAGIC);
  assert.equal(decodeBackupHeader(header),2048);
  assert.throws(()=>decodeBackupHeader(new Uint8Array(12)),/không phải/);
});

test('accepts a valid backup manifest',()=>{
  assert.deepEqual(validateBackupManifest(manifest),manifest);
  const legacy={...manifest,version:1,assets:manifest.assets.map(({sha256:_,...asset})=>asset)};
  assert.deepEqual(validateBackupManifest(legacy),legacy);
});

test('rejects unsafe, incomplete, and oversized backup metadata',()=>{
  assert.throws(()=>validateBackupManifest({...manifest,version:3}),/định dạng/);
  assert.throws(()=>validateBackupManifest({...manifest,assets:[{...manifest.assets[0],fileName:'../photo.jpg'}]}),/media/);
  assert.throws(()=>validateBackupManifest({...manifest,assets:[]}),/thiếu media/);
  assert.throws(()=>validateBackupManifest({...manifest,assets:[{...manifest.assets[0],size:3*1024*1024*1024}]}),/media/);
  assert.throws(()=>validateBackupManifest({...manifest,assets:[{...manifest.assets[0],sha256:undefined}]}),/media/);
  assert.throws(()=>validateBackupManifest({...manifest,memories:[{...note,title:'x'.repeat(101)},photo]}),/kỷ niệm/);
});

test('rejects dangling cover, media without asset and string coordinates',()=>{
  assert.throws(()=>validateBackupManifest({...manifest,coverMemoryId:'missing'}),/Ảnh bìa/);
  assert.throws(()=>validateBackupManifest({...manifest,coverMemoryId:note.id}),/Ảnh bìa/);
  assert.throws(()=>validateBackupManifest({...manifest,memories:[{...photo,fileName:undefined}],assets:[]}),/thiếu media/);
  assert.throws(()=>validateBackupManifest({...manifest,memories:[{...note,latitude:'16.4'},photo]}),/Tọa độ/);
});
