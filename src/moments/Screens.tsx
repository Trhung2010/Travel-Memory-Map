import React,{useCallback,useEffect,useState} from 'react';
import {useFocusEffect,useLocalSearchParams,useRouter} from 'expo-router';
import {ActivityIndicator,Alert,FlatList,Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {fileFor,listPhotos} from '../lib/gallery';
import {C} from '../theme/colors';
import * as api from './api';
import {discardOutgoing,flushOutgoing,listOutgoing,queueMoment,type PendingMoment} from './queue';
import {clearWidget,getWidgetSource,setWidgetSource,syncWidget,widgetAvailable} from './widget';
import {disablePush,enablePush,pushEnabled} from './push';

export const SCENES=[
 'welcome','login','register','profile-setup','camera','edit','send','inbox','moment','memories',
 'memory-detail','friends','find-friends','requests','friend-profile','widget','notifications','profile','settings','privacy'
] as const;
type Scene=typeof SCENES[number];
const TITLES:Record<Scene,string>={
 welcome:'Chào mừng',login:'Đăng nhập',register:'Tạo tài khoản','profile-setup':'Hồ sơ của bạn',
 camera:'Máy ảnh',edit:'Chuẩn bị khoảnh khắc',send:'Gửi khoảnh khắc',inbox:'Ảnh mới',
 moment:'Khoảnh khắc',memories:'Kỷ niệm','memory-detail':'Chi tiết kỷ niệm',
 friends:'Bạn bè','find-friends':'Tìm bạn',requests:'Lời mời kết bạn','friend-profile':'Hồ sơ bạn bè',
 widget:'Widget màn hình chính',notifications:'Thông báo',profile:'Hồ sơ',settings:'Cài đặt',privacy:'Quyền riêng tư'
};
const TABS:{scene:Scene;label:string}[]=[{scene:'camera',label:'Camera'},{scene:'inbox',label:'Khoảnh khắc'},{scene:'friends',label:'Bạn bè'},{scene:'memories',label:'Kỷ niệm'},{scene:'profile',label:'Cá nhân'}];
const caption=(s:string)=>s.trim().slice(0,240);
function Action({label,onPress,secondary=false,disabled=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button,secondary&&styles.secondary,disabled&&{opacity:.45}]}><Text style={[styles.buttonText,secondary&&{color:C.white}]}>{label}</Text></Pressable>;
}
function Card({children}:{children:React.ReactNode}){return <View style={styles.card}>{children}</View>;}
function Empty({text}:{text:string}){return <Text style={styles.empty}>{text}</Text>;}
export default function MomentsScene(){
 const router=useRouter();
 const params=useLocalSearchParams<{scene:string;id?:string;name?:string;caption?:string}>();
 const scene=(SCENES.includes(params.scene as Scene)?params.scene:'welcome') as Scene;
 const id=typeof params.id==='string'?params.id:'';
 const name=typeof params.name==='string'?params.name:'';
 const [account,setAccount]=useState<api.Session|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [displayName,setDisplayName]=useState('');const [handle,setHandle]=useState('');
 const [term,setTerm]=useState('');const [message,setMessage]=useState('');
 const [selected,setSelected]=useState<string[]>([]);
 const [photos,setPhotos]=useState<ReturnType<typeof listPhotos>>([]);
 const [people,setPeople]=useState<api.Profile[]>([]);
 const [friendList,setFriendList]=useState<api.Profile[]>([]);
 const [invites,setInvites]=useState<api.FriendRequest[]>([]);
  const [sentInvites,setSentInvites]=useState<api.FriendRequest[]>([]);
  const [requestPeople,setRequestPeople]=useState<Record<string,api.Profile>>({});
 const [items,setItems]=useState<api.Moment[]>([]);
 const [current,setCurrent]=useState<api.Moment|null>(null);
 const [person,setPerson]=useState<api.Profile|null>(null);
 const [picture,setPicture]=useState('');
 const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
 const [notifications,setNotifications]=useState<api.Notice[]>([]);
 const [blocked,setBlocked]=useState<{blocked_id:string}[]>([]);
 const [reactions,setReactions]=useState<{emoji:string}[]>([]);
  const [outgoing,setOutgoing]=useState<PendingMoment[]>([]);
  const [widgetFriend,setWidgetFriend]=useState<string|null>(null);
  const [devicePush,setDevicePush]=useState(false);
 const go=useCallback((target:Scene,extra:Record<string,string>={})=>router.push({pathname:'/moments/[scene]',params:{scene:target,...extra}}),[router]);
 const work=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task();}catch(e){const text=e instanceof Error?e.message:String(e);setError(text);Alert.alert('Không thể thực hiện',text);}finally{setBusy(false);}};
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const s=await api.session();setAccount(s);
   if(scene==='camera')return;
   if(scene==='edit'||scene==='send'){setPhotos(listPhotos());if(scene==='send'&&s)setFriendList(await api.friends());}
   if(!s)return;
   if(scene==='friends'||scene==='send')setFriendList(await api.friends());
    if(scene==='widget'){setFriendList(await api.friends());setWidgetFriend(await getWidgetSource());}
    if(scene==='requests'){
      const [received,sent]=await Promise.all([api.requests(),api.sentRequests()]);
      setInvites(received);setSentInvites(sent);
      const ids=[...new Set([...received.map(r=>r.sender_id),...sent.map(r=>r.recipient_id)])];
      const profiles=await Promise.all(ids.map(personId=>api.profile(personId).catch(()=>null)));
      setRequestPeople(Object.fromEntries(profiles.filter((p):p is api.Profile=>p!==null).map(p=>[p.id,p])));
    }
    if(scene==='inbox'||scene==='memories'){
     if(scene==='memories')setOutgoing(listOutgoing(s.user.id));
    const found=await api.moments(scene==='inbox'?'inbox':'all');
    setItems(found);
    const urls:Record<string,string>={};
    await Promise.all(found.map(async m=>{try{urls[m.id]=await api.photoUrl(m.media_path);}catch{}}));
    setPhotoUrls(urls);
     if(scene==='inbox')void syncWidget().catch(console.warn);
   }
   if((scene==='moment'||scene==='memory-detail')&&id){
    const m=await api.moment(id);setCurrent(m);
     if(m){setPicture(await api.photoUrl(m.media_path));setReactions(await api.reactionCount(m.id));setPerson(await api.profile(m.owner_id));if(m.owner_id!==s.user.id)await api.markSeen(m.id);}
   }
   if(scene==='friend-profile'&&id)setPerson(await api.profile(id));
   if(scene==='profile'||scene==='profile-setup'){const p=await api.myProfile();setPerson(p);if(p){setDisplayName(p.display_name);setHandle(p.handle);}}
    if(scene==='notifications'){setNotifications(await api.notices());setDevicePush(await pushEnabled());}
   if(scene==='privacy')setBlocked(await api.blocks());
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setLoading(false);}
 },[scene,id]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 useEffect(()=>{
  if(scene!=='find-friends')return;
  if(term.trim().length<2){setPeople([]);return;}
  let active=true;
  const timer=setTimeout(()=>{
   setLoading(true);setError('');
   void api.findPeople(term).then(found=>{if(active)setPeople(found);}).catch(e=>{
    if(active)setError(e instanceof Error?e.message:String(e));
   }).finally(()=>{if(active)setLoading(false);});
  },350);
  return ()=>{active=false;clearTimeout(timer);};
 },[term,scene]);
  const needAuth=!account&&!['welcome','login','register','camera','edit','settings'].includes(scene);
 const photo=(()=>{try{return name?fileFor(name):null;}catch{return null;}})();
 const photoUri=photo?.exists?photo.uri:'';
 const sceneBody=()=>{
  switch(scene){
  case 'welcome':return <><Text style={styles.hero}>Ảnh nhỏ. Kết nối lớn.</Text><Text style={styles.body}>LUMA Moments — chụp ảnh thật, chia sẻ riêng tư với bạn bè. Camera và ảnh cá nhân vẫn dùng offline.</Text>
    <Action label="Đăng nhập" onPress={()=>go('login')}/><Action label="Tạo tài khoản" secondary onPress={()=>go('register')}/><Action label="Mở camera offline" secondary onPress={()=>router.replace('/')}/>
    {!api.configured()&&<Card><Text style={styles.warning}>Chưa cấu hình Supabase. Đăng nhập và gửi ảnh cần backend thật. Xem supabase/README.md.</Text></Card>}</>;
  case 'login':case 'register':return <><Text style={styles.body}>Dùng email và mật khẩu để {scene==='login'?'truy cập':'tạo'} tài khoản LUMA.</Text>
    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail}/>
    <TextInput style={styles.input} placeholder="Mật khẩu (ít nhất 6 ký tự)" placeholderTextColor={C.muted} secureTextEntry value={password} onChangeText={setPassword}/>
    <Action disabled={busy||!email.includes('@')||password.length<6} label={scene==='login'?'Đăng nhập':'Đăng ký'} onPress={()=>void work(async()=>{if(scene==='login'){await api.signIn(email,password);go((await api.myProfile())?'inbox':'profile-setup');}else{const active=await api.signUp(email,password);if(active)go('profile-setup');else Alert.alert('Kiểm tra email','Xác nhận địa chỉ email rồi đăng nhập.');}})}/>
    <Action secondary label={scene==='login'?'Chưa có tài khoản? Đăng ký':'Đã có tài khoản? Đăng nhập'} onPress={()=>go(scene==='login'?'register':'login')}/></>;
  case 'profile-setup':return <><Text style={styles.body}>Chọn tên hiển thị và tên người dùng duy nhất.</Text><TextInput style={styles.input} placeholder="Tên hiển thị" placeholderTextColor={C.muted} value={displayName} onChangeText={setDisplayName}/>
    <TextInput style={styles.input} placeholder="username" autoCapitalize="none" placeholderTextColor={C.muted} value={handle} onChangeText={setHandle}/>
    <Action label="Lưu hồ sơ" disabled={busy||!displayName.trim()||!handle.trim()} onPress={()=>void work(async()=>{await api.saveProfile(displayName,handle.toLowerCase());go('inbox');})}/></>;
  case 'camera':return <><Text style={styles.body}>Camera chính của LUMA vẫn chụp JPEG thật bằng Expo Camera.</Text><Action label="Mở khung ngắm" onPress={()=>router.replace('/')}/><Action secondary label="Chọn ảnh có sẵn trong LUMA" onPress={()=>go('edit')}/></>;
  case 'edit':return <><Text style={styles.body}>Chọn một ảnh đã chụp, sau đó thêm lời nhắn và gửi. Ảnh gốc không bị sửa.</Text>
    {photoUri?<Image source={{uri:photoUri}} style={styles.largeImage}/>:<Empty text="Chưa chọn ảnh. Chạm ảnh bên dưới để tiếp tục."/>}
    <View style={styles.grid}>{photos.map(p=><Pressable key={p.name} onPress={()=>go('edit',{name:p.name})}><Image source={{uri:p.uri}} style={[styles.thumb,p.name===name&&styles.selected]}/></Pressable>)}</View>
    <TextInput style={[styles.input,{minHeight:90}]} multiline maxLength={240} placeholder="Viết vài dòng về khoảnh khắc này..." placeholderTextColor={C.muted} value={message} onChangeText={setMessage}/>
    <Action label="Chọn người nhận" disabled={!photoUri} onPress={()=>go('send',{name,caption:caption(message)})}/>
    <Action label="Mở Color Studio" secondary disabled={!photoUri} onPress={()=>router.push({pathname:'/presets',params:{name}})}/></>;
  case 'send':return <><Text style={styles.body}>Chỉ những người bạn chọn mới được xem ảnh này.</Text>
    {photoUri?<Image source={{uri:photoUri}} style={styles.preview}/>:<Empty text="Không có ảnh hợp lệ. Hãy chọn ảnh trong Camera/Thư viện."/>}
    <Text style={styles.meta}>{friendList.length} bạn bè · đã chọn {selected.length}</Text>
    {friendList.map(p=><Pressable key={p.id} onPress={()=>setSelected(v=>v.includes(p.id)?v.filter(x=>x!==p.id):[...v,p.id])} style={styles.listRow}><Text style={styles.title}>{selected.includes(p.id)?'☑ ':'□ '}{p.display_name||p.handle}</Text><Text style={styles.meta}>@{p.handle}</Text></Pressable>)}
    {!friendList.length&&<Empty text="Chưa có bạn bè. Gửi lời mời và được chấp nhận trước khi gửi ảnh."/>}
    <Action label="Gửi khoảnh khắc" disabled={!photoUri||busy||!selected.length||!account} onPress={()=>void work(async()=>{
      await queueMoment(photoUri,typeof params.caption==='string'?params.caption:'',selected);
      await flushOutgoing();
      Alert.alert('Đã lưu để gửi','Xem trạng thái gửi trong Kỷ niệm. Nếu mất mạng, ảnh sẽ chờ bạn thử lại.',[{text:'Xem kỷ niệm',onPress:()=>go('memories')}]);
    })}/>
    <Action secondary label="Thêm bạn bè" onPress={()=>go('find-friends')}/></>;
   case 'inbox':case 'memories':return <><Text style={styles.body}>{scene==='inbox'?'Những khoảnh khắc được bạn bè gửi riêng cho bạn.':'Khoảnh khắc đã gửi và được chia sẻ với bạn.'}</Text>
    {scene==='memories'&&<><Action secondary label="Thử gửi ảnh đang chờ" disabled={busy||!outgoing.some(o=>o.status==='pending'||o.status==='failed')} onPress={()=>void work(async()=>{await flushOutgoing();await refresh();})}/>
    {outgoing.filter(o=>o.status!=='sent').map(o=><Card key={o.id}><Text style={styles.title}>{o.status==='sending'?'Đang gửi':o.status==='failed'?'Gửi thất bại':'Chờ gửi'} · {new Date(o.created).toLocaleString('vi-VN')}</Text>
      {o.error?<Text style={styles.warning}>{o.error}</Text>:null}<Text style={styles.meta}>{o.recipientIds.length} người nhận</Text>
      <Action secondary label="Hủy ảnh chờ gửi" disabled={busy||o.status==='sending'} onPress={()=>Alert.alert('Hủy gửi ảnh?','Ảnh chờ gửi sẽ được xóa khỏi hàng đợi.',[{text:'Giữ lại',style:'cancel'},{text:'Hủy gửi',style:'destructive',onPress:()=>{if(account){discardOutgoing(account.user.id,o.id);setOutgoing(listOutgoing(account.user.id));}}}])}/></Card>)}</>}
    {!items.length&&<Empty text="Chưa có khoảnh khắc nào. Hãy kết bạn rồi gửi ảnh đầu tiên."/>}
    {items.map(m=><Pressable key={m.id} style={styles.momentCard} onPress={()=>go(scene==='inbox'?'moment':'memory-detail',{id:m.id})}>
      {photoUrls[m.id]?<Image source={{uri:photoUrls[m.id]}} style={styles.feedImage}/>:<Empty text="Ảnh hiện không tải được"/>}
       <Text style={styles.title}>{scene==='inbox'&&!m.seen_at?'● Mới · ':''}{m.caption||'Khoảnh khắc không lời'}</Text><Text style={styles.meta}>{new Date(m.created_at).toLocaleString('vi-VN')}</Text>
    </Pressable>)}
    <Action secondary label="Chụp ảnh mới" onPress={()=>router.push('/')}/></>;
  case 'moment':case 'memory-detail':return current?<><Text style={styles.meta}>{person?.display_name||'Thành viên LUMA'} · {new Date(current.created_at).toLocaleString('vi-VN')}</Text>
    {picture?<Image source={{uri:picture}} style={styles.largeImage}/>:<Empty text="Không thể tải ảnh"/>}<Text style={styles.body}>{current.caption||'Không có chú thích'}</Text>
    <Text style={styles.meta}>{reactions.length} lượt phản hồi</Text><View style={styles.emojiRow}>{['❤️','😂','😍','🥹','🔥','👏'].map(emoji=><Pressable key={emoji} disabled={busy} onPress={()=>void work(async()=>{await api.reactTo(current.id,emoji);setReactions(await api.reactionCount(current.id));})} style={styles.emoji}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</View>
    {person&&<Action secondary label="Xem người gửi" onPress={()=>go('friend-profile',{id:person.id})}/>}</>:<Empty text="Không tìm thấy khoảnh khắc hoặc bạn không có quyền xem."/>;
  case 'friends':return <><Action label="Tìm bạn mới" onPress={()=>go('find-friends')}/><Action secondary label="Lời mời đang chờ" onPress={()=>go('requests')}/>
    {!friendList.length&&<Empty text="Danh sách bạn bè trống."/>}{friendList.map(p=><Pressable key={p.id} style={styles.listRow} onPress={()=>go('friend-profile',{id:p.id})}><Text style={styles.title}>{p.display_name||p.handle}</Text><Text style={styles.meta}>@{p.handle} ›</Text></Pressable>)}</>;
  case 'find-friends':return <><TextInput style={styles.input} placeholder="Tìm theo username (ít nhất 2 ký tự)" placeholderTextColor={C.muted} autoCapitalize="none" value={term} onChangeText={setTerm}/>
    {!people.length&&<Empty text="Nhập username để tìm tài khoản thật."/>}{people.filter(p=>p.id!==account?.user.id).map(p=><View key={p.id} style={styles.listRow}><View style={{flex:1}}><Text style={styles.title}>{p.display_name}</Text><Text style={styles.meta}>@{p.handle}</Text></View><Pressable disabled={busy} onPress={()=>void work(async()=>{await api.requestFriend(p.id);Alert.alert('Đã gửi lời mời',p.display_name);})}><Text style={styles.link}>Thêm bạn</Text></Pressable></View>)}</>;
   case 'requests':return <><Text style={styles.title}>Đã nhận</Text>{!invites.length&&<Empty text="Không có lời mời mới."/>}{invites.map(r=><Card key={r.id}><Text style={styles.title}>Lời mời từ {requestPeople[r.sender_id]?.display_name||'Thành viên LUMA'}</Text><Text style={styles.meta}>@{requestPeople[r.sender_id]?.handle||r.sender_id}</Text><View style={styles.row}><Action label="Chấp nhận" onPress={()=>void work(async()=>{await api.respondFriend(r.id,true);await refresh();})}/><Action secondary label="Từ chối" onPress={()=>void work(async()=>{await api.respondFriend(r.id,false);await refresh();})}/></View></Card>)}
     <Text style={styles.title}>Đã gửi</Text>{!sentInvites.length&&<Empty text="Bạn chưa gửi lời mời nào đang chờ."/>}{sentInvites.map(r=><Card key={r.id}><Text style={styles.title}>{requestPeople[r.recipient_id]?.display_name||'Thành viên LUMA'} · Đang chờ</Text><Action secondary label="Hủy lời mời" onPress={()=>void work(async()=>{await api.cancelRequest(r.id);await refresh();})}/></Card>)}</>;
  case 'friend-profile':return person?<><Text style={styles.hero}>{person.display_name}</Text><Text style={styles.meta}>@{person.handle}</Text>
    <Action label="Chụp ảnh gửi bạn" onPress={()=>router.push('/')}/>
    <Action secondary label="Chặn người dùng" onPress={()=>Alert.alert('Chặn người này?', 'Người bị chặn sẽ không thể tiếp tục chia sẻ khoảnh khắc với bạn.',[{text:'Hủy',style:'cancel'},{text:'Chặn',style:'destructive',onPress:()=>void work(async()=>{await api.blockUser(person.id);go('privacy');})}])}/></>:<Empty text="Không tìm thấy hồ sơ này."/>;
   case 'widget':return <><Text style={styles.hero}>LUMA trên màn hình chính</Text>
     {widgetAvailable()?<><Card><Text style={styles.title}>Widget Android đã sẵn sàng</Text>
       <Text style={styles.body}>Nhấn giữ màn hình chính → Widget → LUMA Moments. Ảnh vừa nhận được đồng bộ khi bạn mở LUMA hoặc nhấn nút bên dưới.</Text></Card>
       <Text style={styles.title}>Hiển thị ảnh từ</Text>
       <Action label={widgetFriend===null?'✓ Tất cả bạn bè':'Tất cả bạn bè'} secondary={widgetFriend!==null} onPress={()=>void work(async()=>{await setWidgetSource(null);setWidgetFriend(null);})}/>
       {friendList.map(friend=><Action key={friend.id} label={`${widgetFriend===friend.id?'✓ ':''}${friend.display_name||friend.handle}`} secondary={widgetFriend!==friend.id} onPress={()=>void work(async()=>{await setWidgetSource(friend.id);setWidgetFriend(friend.id);})}/>)}
       <Action label="Đồng bộ ảnh mới nhất" disabled={busy} onPress={()=>void work(async()=>{await syncWidget();Alert.alert('Đã đồng bộ','Widget đã nhận ảnh mới nhất bạn có quyền xem.');})}/>
     </>:<Card><Text style={styles.warning}>Widget cần APK Android có module native. Expo Go không chứa module này.</Text><Text style={styles.body}>Cài bản development build hoặc APK của LUMA để thêm widget.</Text></Card>}
     <Action secondary label="Xem ảnh nhận được" onPress={()=>go('inbox')}/></>;
   case 'notifications':return <><Card><Text style={styles.title}>Thông báo trên điện thoại</Text><Text style={styles.body}>{devicePush?'Đang bật thông báo đẩy cho ảnh mới.':'Bật để nhận thông báo khi có ảnh mới. Danh sách bên dưới vẫn đồng bộ qua tài khoản.'}</Text>
     <Action label={devicePush?'Tắt thông báo đẩy':'Bật thông báo đẩy'} secondary={devicePush} disabled={busy} onPress={()=>void work(async()=>{if(devicePush)await disablePush();else await enablePush();setDevicePush(!devicePush);})}/></Card>
     {!notifications.length&&<Empty text="Không có thông báo."/>}{notifications.map(n=><Pressable key={n.id} style={styles.listRow} onPress={()=>void work(async()=>{await api.readNotice(n.id);if(n.moment_id)go('moment',{id:n.moment_id});else if(n.kind==='friend_request')go('requests');else go('friends');})}>
    <Text style={styles.title}>{n.kind==='new_moment'?'📷 Ảnh mới':n.kind==='friend_request'?'👋 Lời mời kết bạn':n.kind==='friend_accepted'?'✓ Đã trở thành bạn bè':'❤️ Phản hồi mới'}{n.read_at?'':' · Mới'}</Text>
    <Text style={styles.meta}>{new Date(n.created_at).toLocaleString('vi-VN')}</Text></Pressable>)}</>;
  case 'profile':return <><Text style={styles.hero}>{person?.display_name||account?.user.email||'LUMA'}</Text><Text style={styles.meta}>@{person?.handle||'chưa tạo hồ sơ'}</Text><Action label="Chỉnh hồ sơ" onPress={()=>go('profile-setup')}/>
    <Action secondary label="Thông báo" onPress={()=>go('notifications')}/><Action secondary label="Cài đặt" onPress={()=>go('settings')}/><Action secondary label="Thiết lập widget" onPress={()=>go('widget')}/></>;
  case 'settings':return <><Text style={styles.body}>Cài đặt camera, chất lượng JPEG và lưới căn chỉnh.</Text><Action label="Cài đặt camera" onPress={()=>router.push('/settings')}/>
    <Action secondary label="Quyền riêng tư và chặn" onPress={()=>go('privacy')}/><Action secondary label="Widget" onPress={()=>go('widget')}/>
     <Action secondary label="Đăng xuất" disabled={!account} onPress={()=>void work(async()=>{await clearWidget();await disablePush();await api.signOut();go('welcome');})}/></>;
  case 'privacy':return <><Text style={styles.body}>Ảnh chỉ hiển thị với người nhận do bạn lựa chọn. Danh sách chặn được đồng bộ trên tài khoản.</Text>
    {!blocked.length&&<Empty text="Không có người dùng bị chặn."/>}{blocked.map(b=><View key={b.blocked_id} style={styles.listRow}><Text style={styles.meta}>{b.blocked_id}</Text><Action secondary label="Bỏ chặn" onPress={()=>void work(async()=>{await api.unblock(b.blocked_id);await refresh();})}/></View>)}</>;
  }
 };
 return <SafeAreaView style={styles.page}><View style={styles.header}><Pressable accessibilityRole="button" onPress={()=>router.canGoBack()?router.back():router.replace('/')}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>{TITLES[scene]}</Text><Pressable onPress={()=>go('notifications')}><Text style={styles.back}>◌</Text></Pressable></View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
   {error?<Card><Text style={styles.warning}>{error}</Text><Action secondary label="Thử lại" onPress={()=>void refresh()}/></Card>:null}
   {loading?<ActivityIndicator color={C.accent} style={{marginVertical:15}}/>:null}
   {needAuth?<><Empty text="Cần đăng nhập để dùng tính năng chia sẻ thật."/><Action label="Đăng nhập" onPress={()=>go('login')}/><Action secondary label="Tạo tài khoản" onPress={()=>go('register')}/></>:sceneBody()}
  </ScrollView>
  <View style={styles.nav}>{TABS.map(t=><Pressable key={t.scene} style={styles.navItem} onPress={()=>t.scene==='camera'?router.replace('/'):go(t.scene)}><Text style={[styles.navText,scene===t.scene&&{color:C.accent}]}>{t.label}</Text></Pressable>)}</View>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:C.bg},header:{height:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:18,borderBottomWidth:1,borderColor:C.border},back:{fontSize:28,color:C.white,width:27},headerTitle:{fontSize:17,fontWeight:'700',color:C.white,flex:1},
 scroll:{padding:20,paddingBottom:35,gap:15,flexGrow:1},hero:{fontSize:29,fontWeight:'800',color:C.white,letterSpacing:-.7,marginTop:7},body:{fontSize:14,color:C.muted,lineHeight:22},title:{fontSize:15,color:C.white,fontWeight:'700'},meta:{fontSize:12,color:C.muted,marginTop:5},warning:{fontSize:13,color:C.danger,lineHeight:21},empty:{fontSize:13,color:C.muted,lineHeight:20,marginVertical:16,textAlign:'center'},
 button:{borderRadius:16,backgroundColor:C.accent,paddingVertical:15,paddingHorizontal:19,alignItems:'center',justifyContent:'center'},buttonText:{color:C.bg,fontSize:14,fontWeight:'700'},secondary:{backgroundColor:C.elevated},card:{backgroundColor:C.surface,padding:17,borderRadius:18,gap:10},input:{color:C.white,backgroundColor:C.surface,padding:15,borderRadius:13,fontSize:15,borderWidth:1,borderColor:C.border},
 nav:{borderTopWidth:1,borderColor:C.border,flexDirection:'row',paddingVertical:15,paddingHorizontal:5},navItem:{flex:1,alignItems:'center'},navText:{fontSize:11,color:C.muted,fontWeight:'700'},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:7},thumb:{width:91,height:91,borderRadius:9},selected:{borderColor:C.accent,borderWidth:3},
 preview:{height:200,width:'100%',borderRadius:15,backgroundColor:C.surface},largeImage:{width:'100%',height:340,borderRadius:16,backgroundColor:C.surface},feedImage:{width:'100%',height:260,borderRadius:14,backgroundColor:C.elevated},
 momentCard:{backgroundColor:C.surface,padding:11,borderRadius:19,gap:7},listRow:{backgroundColor:C.surface,padding:15,borderRadius:13,marginBottom:4,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},link:{color:C.accent,fontWeight:'700'},row:{flexDirection:'row',gap:6},emojiRow:{flexDirection:'row',justifyContent:'space-between'},emoji:{backgroundColor:C.surface,padding:8,borderRadius:14},emojiText:{fontSize:22},
});
