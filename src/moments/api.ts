import AsyncStorage from '@react-native-async-storage/async-storage';
import {File} from 'expo-file-system';

export type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};
export type Profile={id:string;handle:string;display_name:string;avatar_url:string|null;created_at?:string};
export type FriendRequest={id:string;sender_id:string;recipient_id:string;status:'pending'|'accepted'|'declined';created_at:string};
export type Moment={id:string;owner_id:string;media_path:string;caption:string;created_at:string};
export type Notice={id:string;kind:string;actor_id:string|null;moment_id:string|null;read_at:string|null;created_at:string};
const KEY='luma.session.v1';
const base=(process.env.EXPO_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
const anon=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'';
export const configured=()=>Boolean(base&&anon);
const fail=()=>{throw new Error('Chưa cấu hình Supabase. Thêm EXPO_PUBLIC_SUPABASE_URL và EXPO_PUBLIC_SUPABASE_ANON_KEY trong .env, sau đó khởi động lại Expo.');};
export async function session():Promise<Session|null>{
  if(!configured())return null;
  const raw=await AsyncStorage.getItem(KEY);if(!raw)return null;
  const s=JSON.parse(raw) as Session;
  if(Date.now()/1000<s.expires_at-60)return s;
  try{
    const next=await rawRequest('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})},false);
    const updated={...next,expires_at:Math.floor(Date.now()/1000)+next.expires_in} as Session;
    await AsyncStorage.setItem(KEY,JSON.stringify(updated));return updated;
  }catch{await AsyncStorage.removeItem(KEY);return null;}
}
async function rawRequest(path:string,init:RequestInit={},authenticate=true):Promise<any>{
  if(!configured())fail();
  const s=authenticate?await session():null;
  const headers:Record<string,string>={apikey:anon,...(init.body instanceof Uint8Array?{}:{'Content-Type':'application/json'}),...(s?{Authorization:'Bearer '+s.access_token}:{Authorization:'Bearer '+anon}),...(init.headers as Record<string,string>||{})};
  const res=await fetch(base+path,{...init,headers});
  const raw=await res.text();
  let value:any;try{value=raw?JSON.parse(raw):null;}catch{value=raw;}
  if(!res.ok)throw new Error(typeof value==='object'?(value?.msg||value?.message||value?.error_description||value?.error||JSON.stringify(value)):String(value||res.statusText));
  return value;
}
export async function signIn(email:string,password:string){
  const result=await rawRequest('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email.trim(),password})},false);
  const next={...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in} as Session;
  await AsyncStorage.setItem(KEY,JSON.stringify(next));return next;
}
export async function signUp(email:string,password:string){
  const result=await rawRequest('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:email.trim(),password})},false);
  if(result?.access_token){await AsyncStorage.setItem(KEY,JSON.stringify({...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in}));return true;}
  return false; // Email confirmation is enabled.
}
export async function signOut(){const s=await session();if(s){try{await rawRequest('/auth/v1/logout',{method:'POST'});}catch{}}await AsyncStorage.removeItem(KEY);}
export async function db<T>(table:string,query='',init:RequestInit={}):Promise<T>{
  return rawRequest('/rest/v1/'+table+(query?'?'+query:''),init,true) as Promise<T>;
}
export async function myProfile(){const s=await session();if(!s)return null;return (await db<Profile[]>('profiles','select=*&id=eq.'+s.user.id))[0]||null;}
export async function saveProfile(name:string,handle:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  if(!/^[a-z0-9_]{3,24}$/.test(handle))throw new Error('Tên người dùng 3–24 ký tự: chữ thường, số hoặc _');
  return db<Profile[]>('profiles','on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:s.user.id,display_name:name.trim(),handle})});
}
export async function findPeople(term:string){
  const t=term.trim().replace(/[^a-zA-Z0-9_]/g,'').slice(0,24);
  if(t.length<2)return [];
  return db<Profile[]>('profiles','select=id,handle,display_name,avatar_url&handle=ilike.*'+encodeURIComponent(t)+'*&limit=25');
}
export async function profile(id:string){return (await db<Profile[]>('profiles','select=*&id=eq.'+encodeURIComponent(id)))[0]||null;}
export async function friends(){
  const s=await session();if(!s)return [];
  const rel=await db<{user_a:string;user_b:string}[]>('friendships','select=user_a,user_b&or=(user_a.eq.'+s.user.id+',user_b.eq.'+s.user.id+')');
  const ids=rel.map(r=>r.user_a===s.user.id?r.user_b:r.user_a);
  return ids.length?db<Profile[]>('profiles','select=*&id=in.('+ids.join(',')+')'):[];
}
export async function requests(){
  const s=await session();if(!s)return [];
  return db<FriendRequest[]>('friend_requests','select=*&recipient_id=eq.'+s.user.id+'&status=eq.pending&order=created_at.desc');
}
export async function requestFriend(recipient_id:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  if(s.user.id===recipient_id)throw new Error('Không thể tự kết bạn');
  await db('friend_requests','',{method:'POST',body:JSON.stringify({sender_id:s.user.id,recipient_id})});
}
export async function respondFriend(id:string,accept:boolean){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  await db('friend_requests','id=eq.'+id+'&recipient_id=eq.'+s.user.id+'&status=eq.pending',{method:'PATCH',body:JSON.stringify({status:accept?'accepted':'declined'})});
}
export async function blockUser(blocked_id:string){const s=await session();if(!s)throw new Error('Cần đăng nhập');await db('blocks','',{method:'POST',body:JSON.stringify({blocker_id:s.user.id,blocked_id})});}
export async function blocks(){const s=await session();if(!s)return [];return db<{blocked_id:string}[]>('blocks','select=blocked_id&blocker_id=eq.'+s.user.id);}
export async function unblock(id:string){const s=await session();if(!s)throw new Error('Cần đăng nhập');await db('blocks','blocker_id=eq.'+s.user.id+'&blocked_id=eq.'+id,{method:'DELETE'});}
export async function upload(uri:string){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  const path=s.user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.jpg';
  const bytes=await new File(uri).bytes();
  await rawRequest('/storage/v1/object/moments/'+path,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes as unknown as BodyInit});
  return path;
}
export async function sendMoment(uri:string,caption:string,recipientIds:string[]){
  const s=await session();if(!s)throw new Error('Cần đăng nhập');
  const recipients=Array.from(new Set(recipientIds)).filter(x=>x!==s.user.id);
  if(!recipients.length)throw new Error('Chưa chọn bạn bè');
  const path=await upload(uri);
  // Database function performs friendship validation and inserts the moment + recipients atomically.
  return rawRequest('/rest/v1/rpc/publish_moment',{method:'POST',body:JSON.stringify({p_media_path:path,p_caption:caption.slice(0,240),p_recipients:recipients})});
}
export async function moments(kind:'inbox'|'sent'|'all'='all'){
  const s=await session();if(!s)return [];
  const filter=kind==='sent'?'&owner_id=eq.'+s.user.id:kind==='inbox'?'&owner_id=neq.'+s.user.id:'';
  return db<Moment[]>('moments','select=id,owner_id,media_path,caption,created_at&order=created_at.desc&limit=100'+filter);
}
export async function moment(id:string){return (await db<Moment[]>('moments','select=*&id=eq.'+id))[0]||null;}
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
