import AsyncStorage from '@react-native-async-storage/async-storage';
import {File} from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as LegacyFS from 'expo-file-system/legacy';

export type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};
export type Profile={id:string;handle:string;display_name:string;avatar_url:string|null;created_at?:string};
export type FriendRequest={id:string;sender_id:string;recipient_id:string;status:'pending'|'accepted'|'declined';created_at:string};
export type Moment={id:string;owner_id:string;media_path:string;caption:string;created_at:string;seen_at?:string|null};
export type Notice={id:string;kind:string;actor_id:string|null;moment_id:string|null;read_at:string|null;created_at:string};
const KEY='luma.session.secure.v1';
const LEGACY_KEY='luma.session.v1';
const base=(process.env.EXPO_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
const anon=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'';
export const configured=()=>Boolean(base&&anon);
const fail=()=>{throw new Error('Chưa cấu hình Supabase. Thêm EXPO_PUBLIC_SUPABASE_URL và EXPO_PUBLIC_SUPABASE_ANON_KEY trong .env, sau đó khởi động lại Expo.');};
async function storedSession(){
  let raw=await SecureStore.getItemAsync(KEY);
  if(!raw){
    const legacy=await AsyncStorage.getItem(LEGACY_KEY);
    if(legacy){await SecureStore.setItemAsync(KEY,legacy);await AsyncStorage.removeItem(LEGACY_KEY);raw=legacy;}
  }
  if(!raw)return null;
  try{
    const value=JSON.parse(raw) as Session;
    if(typeof value?.access_token==='string'&&typeof value?.refresh_token==='string'&&Number.isFinite(value?.expires_at)&&typeof value?.user?.id==='string')return value;
  }catch{}
  await SecureStore.deleteItemAsync(KEY);
  return null;
}
let refreshJob:Promise<Session|null>|null=null;
export async function session():Promise<Session|null>{
  if(!configured())return null;
  const s=await storedSession();if(!s)return null;
  if(Date.now()/1000<s.expires_at-60)return s;
  if(!refreshJob)refreshJob=(async()=>{
    try{
      const next=await rawRequest('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})},false);
      const updated={...next,expires_at:Math.floor(Date.now()/1000)+next.expires_in} as Session;
      await SecureStore.setItemAsync(KEY,JSON.stringify(updated));return updated;
    }catch(e){
      if(e instanceof HttpError && [400,401,403].includes(e.status)){await SecureStore.deleteItemAsync(KEY);return null;}
      // Keep the local identity while offline so a photo can enter the private send queue.
      // Network requests will still require a valid token when connectivity returns.
      return s;
    }
  })().finally(()=>{refreshJob=null;});
  return refreshJob;
}
export class HttpError extends Error{constructor(message:string,public status:number){super(message);this.name='HttpError';}}
async function rawRequest(path:string,init:RequestInit={},authenticate=true):Promise<any>{
  if(!configured())fail();
  const s=authenticate?await session():null;
  if(authenticate&&!s)throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  const headers:Record<string,string>={apikey:anon,...(init.body instanceof Uint8Array?{}:{'Content-Type':'application/json'}),...(s?{Authorization:'Bearer '+s.access_token}:{Authorization:'Bearer '+anon}),...(init.headers as Record<string,string>||{})};
  const res=await fetch(base+path,{...init,headers});
  const raw=await res.text();
  let value:any;try{value=raw?JSON.parse(raw):null;}catch{value=raw;}
  if(!res.ok)throw new HttpError(typeof value==='object'?(value?.msg||value?.message||value?.error_description||value?.error||JSON.stringify(value)):String(value||res.statusText),res.status);
  return value;
}
export async function signIn(email:string,password:string){
  const result=await rawRequest('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email.trim(),password})},false);
  const next={...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in} as Session;
  await SecureStore.setItemAsync(KEY,JSON.stringify(next));return next;
}
export async function signUp(email:string,password:string){
  const result=await rawRequest('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:email.trim(),password})},false);
  if(result?.access_token){await SecureStore.setItemAsync(KEY,JSON.stringify({...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in}));return true;}
  return false; // Email confirmation is enabled.
}
export async function signOut(){
  let s:Session|null=null;
  try{s=await session();}catch{}
  if(s){try{await rawRequest('/auth/v1/logout',{method:'POST'});}catch{}}
  await SecureStore.deleteItemAsync(KEY);
  await AsyncStorage.removeItem(LEGACY_KEY);
  if(s)await AsyncStorage.removeItem('luma.friends.'+s.user.id);
}
export async function db<T>(table:string,query='',init:RequestInit={}):Promise<T>{
  return rawRequest('/rest/v1/'+table+(query?'?'+query:''),init,true) as Promise<T>;
}
export async function myProfile(){const s=await session();if(!s)return null;return (await db<Profile[]>('profiles','select=*&id=eq.'+s.user.id))[0]||null;}
export async function saveProfile(name:string,handle:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  const display=name.trim();
  if(!display||display.length>60)throw new Error('Tên hiển thị phải có từ 1 đến 60 ký tự.');
  if(!/^[a-z0-9_]{3,24}$/.test(handle))throw new Error('Tên người dùng 3–24 ký tự: chữ thường, số hoặc _');
  return db<Profile[]>('profiles','on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:s.user.id,display_name:display,handle})});
}
export async function findPeople(term:string){
  const t=term.trim().replace(/[^a-zA-Z0-9_]/g,'').slice(0,24);
  if(t.length<2)return [];
  return db<Profile[]>('profiles','select=id,handle,display_name,avatar_url&handle=ilike.*'+encodeURIComponent(t)+'*&limit=25');
}
export async function profile(id:string){return (await db<Profile[]>('profiles','select=*&id=eq.'+encodeURIComponent(id)))[0]||null;}
export async function friends(){
  const s=await session();if(!s)return [];
  const key='luma.friends.'+s.user.id;
  try{
    const rel=await db<{user_a:string;user_b:string}[]>('friendships','select=user_a,user_b&or=(user_a.eq.'+s.user.id+',user_b.eq.'+s.user.id+')');
    const ids=rel.map(r=>r.user_a===s.user.id?r.user_b:r.user_a);
    const result=ids.length?await db<Profile[]>('profiles','select=*&id=in.('+ids.join(',')+')'):[];
    await AsyncStorage.setItem(key,JSON.stringify(result));
    return result;
  }catch(e){
    if(e instanceof HttpError)throw e;
    const cached=await AsyncStorage.getItem(key);
    if(!cached)throw e;
    try{return JSON.parse(cached) as Profile[];}catch{throw e;}
  }
}
export async function requests(){
  const s=await session();if(!s)return [];
  return db<FriendRequest[]>('friend_requests','select=*&recipient_id=eq.'+s.user.id+'&status=eq.pending&order=created_at.desc');
}
export async function sentRequests(){
  const s=await session();if(!s)return [];
  return db<FriendRequest[]>('friend_requests','select=*&sender_id=eq.'+s.user.id+'&status=eq.pending&order=created_at.desc');
}
export async function cancelRequest(id:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  await db('friend_requests','id=eq.'+encodeURIComponent(id)+'&sender_id=eq.'+s.user.id+'&status=eq.pending',{method:'DELETE'});
}
export async function requestFriend(recipient_id:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  if(s.user.id===recipient_id)throw new Error('Không thể tự kết bạn');
  // A declined request is retained for history, so remove it before sending a fresh one.
  await db('friend_requests','sender_id=eq.'+s.user.id+'&recipient_id=eq.'+encodeURIComponent(recipient_id)+'&status=eq.declined',{method:'DELETE'});
  await db('friend_requests','',{method:'POST',body:JSON.stringify({sender_id:s.user.id,recipient_id})});
}
export async function respondFriend(id:string,accept:boolean){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  await db('friend_requests','id=eq.'+id+'&recipient_id=eq.'+s.user.id+'&status=eq.pending',{method:'PATCH',body:JSON.stringify({status:accept?'accepted':'declined'})});
}
export async function blockUser(blocked_id:string){const s=await session();if(!s)throw new Error('Cần đăng nhập');await db('blocks','',{method:'POST',body:JSON.stringify({blocker_id:s.user.id,blocked_id})});}
export async function blocks(){const s=await session();if(!s)return [];return db<{blocked_id:string}[]>('blocks','select=blocked_id&blocker_id=eq.'+s.user.id);}
export async function unblock(id:string){const s=await session();if(!s)throw new Error('Cần đăng nhập');await db('blocks','blocker_id=eq.'+s.user.id+'&blocked_id=eq.'+id,{method:'DELETE'});}
export async function upload(uri:string,uploadId?:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  const photo=new File(uri);
  if(!photo.exists||!photo.size||photo.size>10*1024*1024)throw new Error('Ảnh không tồn tại hoặc vượt giới hạn 10 MB.');
  const id=uploadId??`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Mã ảnh không hợp lệ');
  const path=s.user.id+'/'+id+'.jpg';
  const result=await LegacyFS.uploadAsync(base+'/storage/v1/object/moments/'+path,uri,{
    httpMethod:'POST',uploadType:LegacyFS.FileSystemUploadType.BINARY_CONTENT,
    headers:{apikey:anon,Authorization:'Bearer '+s.access_token,'Content-Type':'image/jpeg','x-upsert':'false'},
  });
  // Retrying a queued upload may find the previous upload even if publishing failed.
  if(result.status!==409&&(result.status<200||result.status>=300))throw new HttpError(result.body||'Không tải ảnh lên được',result.status);
  return path;
}
export async function sendMoment(uri:string,caption:string,recipientIds:string[],clientId?:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  const recipients=Array.from(new Set(recipientIds)).filter(x=>x!==s.user.id);
  if(!recipients.length)throw new Error('Chưa chọn bạn bè');
  if(clientId&&!/^[0-9a-f-]{36}$/i.test(clientId))throw new Error('Mã gửi không hợp lệ');
  const path=await upload(uri,clientId);
  // Database function performs friendship validation and inserts the moment + recipients atomically.
  const momentId=await rawRequest('/rest/v1/rpc/publish_moment',{method:'POST',body:JSON.stringify({p_media_path:path,p_caption:caption.slice(0,240),p_recipients:recipients,p_client_id:clientId??null})}) as string;
  // Push delivery is a side effect; the moment remains sent if push is unavailable.
  void rawRequest('/functions/v1/notify-moment',{method:'POST',body:JSON.stringify({momentId})}).catch(console.warn);
  return momentId;
}
export async function registerPushToken(token:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  await db('push_tokens','on_conflict=user_id,token',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({user_id:s.user.id,token})});
}
export async function removePushToken(token:string){
  const s=await session();if(!s)return;
  await db('push_tokens','user_id=eq.'+s.user.id+'&token=eq.'+encodeURIComponent(token),{method:'DELETE'});
}
export async function moments(kind:'inbox'|'sent'|'all'='all'){
  const s=await session();if(!s)return [];
  const filter=kind==='sent'?'&owner_id=eq.'+s.user.id:kind==='inbox'?'&owner_id=neq.'+s.user.id:'';
  const rows=await db<Moment[]>('moments','select=id,owner_id,media_path,caption,created_at&order=created_at.desc&limit=100'+filter);
  if(kind!=='inbox'||!rows.length)return rows;
  const receipts=await db<{moment_id:string;seen_at:string|null}[]>('moment_recipients','select=moment_id,seen_at&recipient_id=eq.'+s.user.id);
  const seen=new Map(receipts.map(r=>[r.moment_id,r.seen_at]));
  return rows.map(row=>({...row,seen_at:seen.get(row.id)??null}));
}
export async function moment(id:string){return (await db<Moment[]>('moments','select=*&id=eq.'+id))[0]||null;}
export async function markSeen(id:string){
  const s=await session();if(!s)return;
  await db('moment_recipients','moment_id=eq.'+encodeURIComponent(id)+'&recipient_id=eq.'+s.user.id+'&seen_at=is.null',{method:'PATCH',body:JSON.stringify({seen_at:new Date().toISOString()})});
}
export async function photoUrl(media_path:string){
  const result=await rawRequest('/storage/v1/object/sign/moments/'+media_path,{method:'POST',body:JSON.stringify({expiresIn:1800})});
  const signed=(result?.signedURL||'') as string;
  if(!signed)throw new Error('Không tạo được URL ảnh');
  return signed.startsWith('http')?signed:base+(signed.startsWith('/storage/v1/')?'':'/storage/v1')+(signed.startsWith('/')?'':'/')+signed;
}
export async function reactTo(moment_id:string,emoji:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  await db('reactions','on_conflict=moment_id,user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({moment_id,user_id:s.user.id,emoji})});
}
export async function reactionCount(moment_id:string){return db<{emoji:string}[]>('reactions','select=emoji&moment_id=eq.'+moment_id);}
export async function notices(){return db<Notice[]>('notifications','select=*&order=created_at.desc&limit=100');}
export async function readNotice(id:string){await db('notifications','id=eq.'+id,{method:'PATCH',body:JSON.stringify({read_at:new Date().toISOString()})});}
