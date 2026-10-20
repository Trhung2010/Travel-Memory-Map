import { Directory, File, Paths } from 'expo-file-system';

export type GalleryPhoto = {name:string;uri:string;size:number;created:number};
const folder = () => new Directory(Paths.document, 'LUMA');
function createdFromName(name:string){
  const match=/^LUMA_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name);
  if(!match)return 0;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`).getTime();
}
export function ensureFolder() { const dir=folder(); if(!dir.exists) dir.create({intermediates:true,idempotent:true}); return dir; }
export function fileFor(name:string) {
  if(!/^LUMA_[A-Za-z0-9_.-]+\.jpg$/.test(name) || name.includes('..')) throw new Error('Tên ảnh không hợp lệ');
  return new File(ensureFolder(), name);
}
export function listPhotos():GalleryPhoto[]{
  return ensureFolder().list().filter((item):item is File=>item instanceof File && /^LUMA_[A-Za-z0-9_.-]+\.jpg$/.test(item.name))
   .map(f=>({name:f.name,uri:f.uri,size:f.size,created:f.creationTime||createdFromName(f.name)||0}))
   .sort((a,b)=>b.created-a.created);
}
export async function keepPhoto(cacheUri:string):Promise<GalleryPhoto>{
  const name=`LUMA_${new Date().toISOString().replace(/[-:.TZ]/g,'')}_${Math.random().toString(36).slice(2,8)}_original.jpg`;
  const source = new File(cacheUri);
  const output = fileFor(name);
  await source.copy(output);
  return {name,uri:output.uri,size:output.size,created:Date.now()};
}
export function removePhoto(name:string) { const f=fileFor(name); if(f.exists) f.delete(); }
export function derivedName(original:string,preset:string) {
  const stem=original.replace(/\.jpg$/,'').replace(/_original$/,'');
  return `${stem}_${preset.replace(/[^a-z0-9-]/g,'')}_${Date.now()}.jpg`;
}
