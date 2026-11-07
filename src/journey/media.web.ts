export type JourneyStorageReport={totalBytes:number;trackedBytes:number;orphanBytes:number;orphanUris:string[];missingUris:string[]};

export async function persistJourneyAsset(uri:string,fileName?:string):Promise<{uri:string;fileName:string}>{
  const response=await fetch(uri);
  if(!response.ok)throw new Error('Không đọc được file đã chọn.');
  const blob=await response.blob();
  if(blob.size>50*1024*1024)throw new Error('Bản web hỗ trợ tối đa 50 MB mỗi file. Hãy chọn video ngắn hơn.');
  const data=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result as string);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return {uri:data,fileName:fileName||'media'};
}
export async function persistJourneyAssetCommitted<T>(uri:string,fileName:string|undefined,commit:(stored:{uri:string;fileName:string})=>T|Promise<T>):Promise<T>{
  return await commit(await persistJourneyAsset(uri,fileName));
}
// Web media is stored inside the IndexedDB snapshot, so deleting metadata
// also releases its data once that snapshot commits.
export function removeJourneyAsset(_uri?:string){}
export function inspectJourneyStorage(referencedUris:string[]):JourneyStorageReport{
  const totalBytes=[...new Set(referencedUris)].reduce((sum,uri)=>sum+(uri.startsWith('data:')?Math.floor((uri.length-uri.indexOf(',')-1)*.75):0),0);
  return {totalBytes,trackedBytes:totalBytes,orphanBytes:0,orphanUris:[],missingUris:[]};
}
export function removeOrphanJourneyAssets(_uris:string[]){return 0;}
export function createJourneyAssetFile(_name:string):never{throw new Error('Khôi phục file sao lưu hiện chỉ hỗ trợ trên ứng dụng di động.');}
