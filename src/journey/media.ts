import {Directory,File,Paths} from 'expo-file-system';

export const journeyMediaFolder=()=>new Directory(Paths.document,'TravelMemoryMap');

function ensureFolder(){const dir=journeyMediaFolder();if(!dir.exists)dir.create({intermediates:true,idempotent:true});return dir;}

function safeExtension(name:string|undefined,uri:string){
  const candidate=(name||uri.split(/[?#]/)[0].split('/').pop()||'').match(/\.([a-zA-Z0-9]{1,8})$/)?.[1];
  return candidate?.toLowerCase()||'bin';
}

export async function persistJourneyAsset(uri:string,fileName?:string):Promise<{uri:string;fileName:string}>{
  const extension=safeExtension(fileName,uri);
  const base=(fileName||`memory-${Date.now()}.${extension}`).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90);
  const storedName=`${Date.now()}-${Math.random().toString(36).slice(2,8)}-${base}`;
  const output=new File(ensureFolder(),storedName);
  await new File(uri).copy(output);
  return {uri:output.uri,fileName:base};
}

export async function persistJourneyAssetCommitted<T>(uri:string,fileName:string|undefined,commit:(stored:{uri:string;fileName:string})=>T|Promise<T>):Promise<T>{
  const stored=await persistJourneyAsset(uri,fileName);
  try{return await commit(stored);}catch(error){removeJourneyAsset(stored.uri);throw error;}
}

export function createJourneyAssetFile(fileName:string){
  const safe=fileName.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90)||'asset.bin';
  const output=new File(ensureFolder(),`${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`);
  output.create({intermediates:true});
  return output;
}

export function removeJourneyAsset(uri?:string){
  if(!uri||!uri.includes('/TravelMemoryMap/'))return;
  try{const file=new File(uri);if(file.exists)file.delete();}catch{/* Metadata deletion must still succeed if a file was already removed. */}
}

export type JourneyStorageReport={totalBytes:number;trackedBytes:number;orphanBytes:number;orphanUris:string[];missingUris:string[]};

export function inspectJourneyStorage(referencedUris:string[]):JourneyStorageReport{
  const referenced=new Set(referencedUris.filter(Boolean).map(uri=>new File(uri).uri));
  const directory=journeyMediaFolder();const files=directory.exists?directory.list().filter((entry):entry is File=>entry instanceof File):[];
  let totalBytes=0,trackedBytes=0,orphanBytes=0;const orphanUris:string[]=[];
  for(const file of files){const size=Number.isFinite(file.size)?file.size:0;totalBytes+=size;if(referenced.has(file.uri))trackedBytes+=size;else{orphanBytes+=size;orphanUris.push(file.uri);}}
  const existing=new Set(files.map(file=>file.uri));const missingUris=[...referenced].filter(uri=>!existing.has(uri));
  return {totalBytes,trackedBytes,orphanBytes,orphanUris,missingUris};
}

export function removeOrphanJourneyAssets(referencedUris:string[]){
  const report=inspectJourneyStorage(referencedUris);
  let removed=0;
  for(const uri of report.orphanUris){
    const file=new File(uri);
    // Fresh files may belong to an import or capture that has not committed yet.
    const modified=file.modificationTime;
    if(!modified||Date.now()-modified<60*60*1000)continue;
    file.delete();removed++;
  }
  return removed;
}
