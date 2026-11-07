import type {JourneyMemory,MemoryDraft,Trip,TripDraft} from './types';
import {isValidLocalDate,parseCoordinates,validateTripDraft,validItinerary} from './validation.ts';

export const BACKUP_MAGIC='TMMAP001';
export const BACKUP_VERSION=2;
export const MAX_BACKUP_MANIFEST_BYTES=5*1024*1024;
export const MAX_BACKUP_ASSETS=2000;
export const MAX_BACKUP_ASSET_BYTES=2*1024*1024*1024;

export type BackupAsset={memoryId:string;fileName:string;mimeType?:string;size:number;sha256?:string};
export type BackupMemory=Omit<JourneyMemory,'uri'>;
export type BackupManifest={
  format:'travel-memory-map';
  version:1|2;
  exportedAt:string;
  coverMemoryId?:string;
  trip:Trip;
  memories:BackupMemory[];
  assets:BackupAsset[];
};

export type ImportedTrip={trip:TripDraft & Pick<Trip,'coverUri'|'itinerary'>;memories:Array<Omit<MemoryDraft,'tripId'>>};

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null;}

function safeName(value:string){
  const name=value.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90);
  return name||'asset.bin';
}

export function sanitizeBackupFileName(value:string){return safeName(value);}

export function validateBackupManifest(value:unknown):BackupManifest{
  if(!isRecord(value)||value.format!=='travel-memory-map'||(value.version!==1&&value.version!==BACKUP_VERSION)||typeof value.exportedAt!=='string'||!Number.isFinite(Date.parse(value.exportedAt)))throw new Error('File sao lưu không đúng định dạng Travel Memory Map.');
  if(!isRecord(value.trip)||!Array.isArray(value.memories)||!Array.isArray(value.assets))throw new Error('File sao lưu thiếu dữ liệu chuyến đi.');
  const trip=value.trip;
  if(typeof trip.id!=='string'||typeof trip.title!=='string'||typeof trip.destination!=='string'||typeof trip.description!=='string'||typeof trip.startDate!=='string'||typeof trip.endDate!=='string'||!isValidLocalDate(trip.startDate)||!isValidLocalDate(trip.endDate))throw new Error('Thông tin chuyến đi trong file sao lưu không hợp lệ.');
  validateTripDraft({title:trip.title,destination:trip.destination,description:trip.description,startDate:trip.startDate,endDate:trip.endDate});
  if(!validItinerary(trip.itinerary,trip.startDate,trip.endDate))throw new Error('Lịch trình sao lưu không hợp lệ.');
  if(value.memories.length>MAX_BACKUP_ASSETS||value.assets.length>MAX_BACKUP_ASSETS)throw new Error('File sao lưu có quá nhiều nội dung.');
  const memoryIds=new Set<string>();
  for(const memory of value.memories){
    if(!isRecord(memory)||typeof memory.id!=='string'||memory.id.length>200||typeof memory.tripId!=='string'||memory.tripId!==trip.id||!['photo','video','audio','note','document'].includes(String(memory.kind))||typeof memory.title!=='string'||memory.title.length>100||typeof memory.note!=='string'||memory.note.length>1000||typeof memory.createdAt!=='string'||!Number.isFinite(Date.parse(memory.createdAt))||(memory.mimeType!==undefined&&(typeof memory.mimeType!=='string'||memory.mimeType.length>200))||(memory.durationMs!==undefined&&(typeof memory.durationMs!=='number'||!Number.isFinite(memory.durationMs)||memory.durationMs<0)))throw new Error('File sao lưu chứa kỷ niệm không hợp lệ.');
    if(memoryIds.has(memory.id))throw new Error('File sao lưu chứa mã kỷ niệm bị trùng.');
    memoryIds.add(memory.id);
    if(memory.favorite!==undefined&&typeof memory.favorite!=='boolean')throw new Error('Yêu thích không hợp lệ.');
    if(memory.tags!==undefined&&(!Array.isArray(memory.tags)||memory.tags.length>10||!memory.tags.every(tag=>typeof tag==='string'&&tag.length<=250)))throw new Error('Nhãn không hợp lệ.');
    if(memory.deletedAt!==undefined&&(typeof memory.deletedAt!=='string'||!Number.isFinite(Date.parse(memory.deletedAt))))throw new Error('Thùng rác không hợp lệ.');
    if((memory.latitude!==undefined&&typeof memory.latitude!=='number')||(memory.longitude!==undefined&&typeof memory.longitude!=='number'))throw new Error('Tọa độ phải là số.');
    parseCoordinates(memory.latitude===undefined?'':String(memory.latitude),memory.longitude===undefined?'':String(memory.longitude));
  }
  const assetMemoryIds=new Set<string>();
  for(const asset of value.assets){
    if(!isRecord(asset)||typeof asset.memoryId!=='string'||!memoryIds.has(asset.memoryId)||assetMemoryIds.has(asset.memoryId)||typeof asset.fileName!=='string'||!asset.fileName||asset.fileName!==safeName(asset.fileName)||typeof asset.size!=='number'||!Number.isSafeInteger(asset.size)||asset.size<0||asset.size>MAX_BACKUP_ASSET_BYTES||(asset.mimeType!==undefined&&(typeof asset.mimeType!=='string'||asset.mimeType.length>200))||(value.version===2&&(typeof asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(asset.sha256)))||(asset.sha256!==undefined&&(typeof asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(asset.sha256))))throw new Error('File sao lưu chứa media không hợp lệ.');
    assetMemoryIds.add(asset.memoryId);
  }
  for(const memory of value.memories){
    const hasAsset=assetMemoryIds.has((memory as BackupMemory).id);
    if((memory as BackupMemory).kind!=='note'&&!hasAsset)throw new Error('File sao lưu thiếu media của kỷ niệm.');
    if(Boolean((memory as Record<string,unknown>).fileName)!==hasAsset)throw new Error('File sao lưu thiếu media của kỷ niệm.');
  }
  if(value.coverMemoryId!==undefined&&(typeof value.coverMemoryId!=='string'||!assetMemoryIds.has(value.coverMemoryId)||!value.memories.some(memory=>memory.id===value.coverMemoryId&&memory.kind==='photo')))throw new Error('Ảnh bìa sao lưu không hợp lệ.');
  return value as BackupManifest;
}

export function encodeBackupHeader(manifestLength:number){
  if(!Number.isSafeInteger(manifestLength)||manifestLength<=0||manifestLength>MAX_BACKUP_MANIFEST_BYTES)throw new Error('Metadata sao lưu vượt giới hạn.');
  const output=new Uint8Array(12);output.set(new TextEncoder().encode(BACKUP_MAGIC),0);new DataView(output.buffer).setUint32(8,manifestLength,true);return output;
}

export function decodeBackupHeader(input:Uint8Array){
  if(input.byteLength!==12||new TextDecoder().decode(input.slice(0,8))!==BACKUP_MAGIC)throw new Error('File đã chọn không phải bản sao lưu Travel Memory Map.');
  const manifestLength=new DataView(input.buffer,input.byteOffset,input.byteLength).getUint32(8,true);
  if(manifestLength<=0||manifestLength>MAX_BACKUP_MANIFEST_BYTES)throw new Error('Metadata sao lưu vượt giới hạn.');
  return manifestLength;
}
