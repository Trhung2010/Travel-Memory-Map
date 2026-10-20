import AsyncStorage from '@react-native-async-storage/async-storage';
import {fileFor,listPhotos,removePhoto,type GalleryPhoto} from './gallery';

const KEY='luma.local-library.v1';
export type Album={id:string;title:string;created:number};
type PhotoMeta={favorite?:boolean;albumIds?:string[];parent?:string};
type LibraryState={albums:Album[];photos:Record<string,PhotoMeta>};
export type LocalPhoto=GalleryPhoto&{favorite:boolean;albumIds:string[];parent?:string};
const empty=():LibraryState=>({albums:[],photos:{}});
let writes:Promise<unknown>=Promise.resolve();

async function read():Promise<LibraryState>{
  const value=await AsyncStorage.getItem(KEY);
  if(!value)return empty();
  try{
    const parsed=JSON.parse(value) as LibraryState;
    return {albums:Array.isArray(parsed.albums)?parsed.albums:[],photos:parsed.photos&&typeof parsed.photos==='object'?parsed.photos:{}};
  }catch{throw new Error('Dữ liệu album trên máy bị lỗi. LUMA sẽ không ghi đè lên dữ liệu này.');}
}
async function change<T>(fn:(state:LibraryState)=>T):Promise<T>{
  const task=writes.then(async()=>{const state=await read();const result=fn(state);await AsyncStorage.setItem(KEY,JSON.stringify(state));return result;});
  writes=task.catch(()=>undefined);
  return task;
}
export async function library():Promise<{photos:LocalPhoto[];albums:Album[]}>{
  await writes;
  const state=await read();
  const photos=listPhotos().map(photo=>({...photo,favorite:!!state.photos[photo.name]?.favorite,
    albumIds:(state.photos[photo.name]?.albumIds||[]).filter(id=>state.albums.some(a=>a.id===id)),parent:state.photos[photo.name]?.parent}));
  return {photos,albums:state.albums};
}
export async function toggleFavorite(name:string):Promise<boolean>{
  fileFor(name);
  return change(state=>{const meta=state.photos[name]||{};meta.favorite=!meta.favorite;state.photos[name]=meta;return !!meta.favorite;});
}
export async function createAlbum(title:string):Promise<Album>{
  const trimmed=title.trim().slice(0,50);if(!trimmed)throw new Error('Nhập tên album.');
  return change(state=>{const album={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:trimmed,created:Date.now()};state.albums.push(album);return album;});
}
export async function setAlbum(name:string,albumId:string,add:boolean):Promise<void>{
  fileFor(name);
  await change(state=>{if(!state.albums.some(a=>a.id===albumId))throw new Error('Không tìm thấy album.');
    const meta=state.photos[name]||{};const ids=new Set(meta.albumIds||[]);if(add)ids.add(albumId);else ids.delete(albumId);meta.albumIds=[...ids];state.photos[name]=meta;});
}
export async function deleteAlbum(albumId:string):Promise<void>{
  await change(state=>{state.albums=state.albums.filter(a=>a.id!==albumId);for(const meta of Object.values(state.photos))meta.albumIds=meta.albumIds?.filter(id=>id!==albumId);});
}
export async function registerVariant(name:string,parent:string):Promise<void>{
  fileFor(name);fileFor(parent);await change(state=>{state.photos[name]={...state.photos[name],parent};});
}
export async function deleteLocalPhoto(name:string):Promise<void>{
  await writes;removePhoto(name);
  await change(state=>{delete state.photos[name];for(const meta of Object.values(state.photos))if(meta.parent===name)delete meta.parent;});
}
