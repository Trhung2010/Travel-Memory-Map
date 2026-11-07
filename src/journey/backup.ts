import {File,FileMode,Paths} from 'expo-file-system';
import type {JourneyMemory,MemoryDraft,Trip} from './types';
import {createJourneyAssetFile,removeJourneyAsset} from './media';
import {decodeBackupHeader,encodeBackupHeader,sanitizeBackupFileName,validateBackupManifest,type BackupAsset,type BackupManifest,type BackupMemory,type ImportedTrip} from './backupFormat';

const CHUNK_BYTES=1024*1024;
const FREE_SPACE_RESERVE=20*1024*1024;

function withoutUri(memory:JourneyMemory,fileName?:string):BackupMemory{
  const {uri:_,...rest}=memory;
  return {...rest,fileName};
}

async function copyBytes(source:ReturnType<File['open']>,destination:ReturnType<File['open']>,size:number){
  let remaining=size;
  while(remaining>0){const bytes=await source.readBytes(Math.min(CHUNK_BYTES,remaining));if(!bytes.byteLength)throw new Error('File media bị thiếu dữ liệu.');await destination.writeBytes(bytes);remaining-=bytes.byteLength;}
}

export async function createTripBackup(trip:Trip,memories:JourneyMemory[],onProgress?:(done:number,total:number)=>void){
  const sources:Array<{file:File;asset:BackupAsset}>=[];
  const backupMemories:BackupMemory[]=[];
  for(const memory of memories.filter(item=>item.tripId===trip.id)){
    if(!memory.uri){backupMemories.push(withoutUri(memory,undefined));continue;}
    const file=new File(memory.uri);
    if(!file.exists||!Number.isSafeInteger(file.size)||file.size<0)throw new Error(`Không đọc được media của “${memory.title}”.`);
    const fileName=sanitizeBackupFileName(memory.fileName||file.name||'asset.bin');
    const asset:BackupAsset={memoryId:memory.id,fileName,mimeType:memory.mimeType,size:file.size,sha256:await file.digest('SHA-256')};
    sources.push({file,asset});backupMemories.push(withoutUri(memory,fileName));
  }
  const coverMemoryId=trip.coverUri?memories.find(memory=>memory.tripId===trip.id&&memory.kind==='photo'&&memory.uri===trip.coverUri)?.id:undefined;
  if(trip.coverUri&&!coverMemoryId)throw new Error('Không tìm thấy kỷ niệm ảnh bìa để sao lưu.');
  const manifest:BackupManifest={format:'travel-memory-map',version:2,exportedAt:new Date().toISOString(),coverMemoryId,trip:{...trip,trace:undefined,coverUri:undefined},memories:backupMemories,assets:sources.map(item=>item.asset)};
  validateBackupManifest(manifest);
  const manifestBytes=new TextEncoder().encode(JSON.stringify(manifest));
  const totalAssetBytes=sources.reduce((sum,item)=>sum+item.asset.size,0);
  if(Paths.availableDiskSpace<totalAssetBytes+manifestBytes.byteLength+FREE_SPACE_RESERVE)throw new Error('Không đủ dung lượng trống để tạo bản sao lưu.');
  const output=new File(Paths.cache,`travel-memory-${Date.now()}.travelmap`);output.create({overwrite:true,intermediates:true});
  try{
    const destination=output.open(FileMode.WriteOnly);
    try{
    await destination.writeBytes(encodeBackupHeader(manifestBytes.byteLength));await destination.writeBytes(manifestBytes);
    let done=0;onProgress?.(done,totalAssetBytes);
    for(const {file,asset} of sources){const source=file.open(FileMode.ReadOnly);try{let remaining=asset.size;while(remaining>0){const bytes=await source.readBytes(Math.min(CHUNK_BYTES,remaining));if(!bytes.byteLength)throw new Error(`Media “${asset.fileName}” bị thiếu dữ liệu.`);await destination.writeBytes(bytes);remaining-=bytes.byteLength;done+=bytes.byteLength;onProgress?.(done,totalAssetBytes);}}finally{source.close();}}
    }finally{destination.close();}
  }catch(error){if(output.exists)output.delete();throw error;}
  return output;
}

export async function readTripBackup(uri:string,onProgress?:(done:number,total:number)=>void):Promise<{data:ImportedTrip;createdUris:string[]}>{
  const input=new File(uri);if(!input.exists||input.size<13)throw new Error('File sao lưu trống hoặc không thể đọc.');
  const source=input.open(FileMode.ReadOnly);const createdUris:string[]=[];
  try{
    const header=await source.readBytes(12);const manifestLength=decodeBackupHeader(header);
    const manifestBytes=await source.readBytes(manifestLength);if(manifestBytes.byteLength!==manifestLength)throw new Error('File sao lưu bị cắt mất metadata.');
    let parsed:unknown;try{parsed=JSON.parse(new TextDecoder().decode(manifestBytes));}catch{throw new Error('Metadata trong file sao lưu bị hỏng.');}
    const manifest=validateBackupManifest(parsed);const totalAssetBytes=manifest.assets.reduce((sum,item)=>sum+item.size,0);
    if(input.size!==12+manifestLength+totalAssetBytes)throw new Error('Kích thước file sao lưu không khớp metadata.');
    if(Paths.availableDiskSpace<totalAssetBytes+FREE_SPACE_RESERVE)throw new Error('Không đủ dung lượng trống để khôi phục chuyến đi.');
    const restoredByMemory=new Map<string,{uri:string;fileName:string}>();let done=0;onProgress?.(done,totalAssetBytes);
    for(const asset of manifest.assets){const output=createJourneyAssetFile(asset.fileName);createdUris.push(output.uri);const destination=output.open(FileMode.WriteOnly);try{await copyBytes(source,destination,asset.size);}finally{destination.close();}if(asset.sha256&&await output.digest('SHA-256')!==asset.sha256)throw new Error(`Media “${asset.fileName}” không còn nguyên vẹn.`);done+=asset.size;onProgress?.(done,totalAssetBytes);restoredByMemory.set(asset.memoryId,{uri:output.uri,fileName:asset.fileName});}
    const data:ImportedTrip={trip:{title:`${manifest.trip.title.slice(0,67)} (khôi phục)`,coverUri:manifest.coverMemoryId?restoredByMemory.get(manifest.coverMemoryId)?.uri:undefined,itinerary:manifest.trip.itinerary,destination:manifest.trip.destination,description:manifest.trip.description,startDate:manifest.trip.startDate,endDate:manifest.trip.endDate},memories:manifest.memories.map(memory=>{const restored=restoredByMemory.get(memory.id);const {id:_,tripId:__,...draft}=memory;return {...draft,uri:restored?.uri,fileName:restored?.fileName};})};
    return {data,createdUris};
  }catch(error){createdUris.forEach(removeJourneyAsset);throw error;}finally{source.close();}
}
