import React,{useCallback,useEffect,useRef,useState} from 'react';
import {CameraView,useCameraPermissions,type CameraType,type FlashMode} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import {useFocusEffect,useRouter} from 'expo-router';
import {ActivityIndicator,Alert,AppState,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Action} from '../src/components/Ui';
import {keepPhoto} from '../src/lib/gallery';
import {usePrefs} from '../src/state/Prefs';
import {C} from '../src/theme/colors';

const flashModes:FlashMode[]=['off','auto','on'];
const nav=[{label:'Khoảnh khắc',scene:'inbox',icon:'▣'},{label:'Bạn bè',scene:'friends',icon:'♡'},{label:'Kỷ niệm',scene:'memories',icon:'◷'},{label:'Cá nhân',scene:'profile',icon:'◉'}];
export default function CameraScreen(){
 const router=useRouter();const camera=useRef<CameraView>(null);
 const alive=useRef(false),session=useRef(0),busy=useRef(false);
 const [permission,requestPermission]=useCameraPermissions();
 const [focused,setFocused]=useState(false),[appActive,setAppActive]=useState(AppState.currentState==='active');
 const [facing,setFacing]=useState<CameraType>('back'),[flash,setFlash]=useState<FlashMode>('off');
 const [zoom,setZoom]=useState(0),[ready,setReady]=useState(false),[shooting,setShooting]=useState(false);
 const [countdown,setCountdown]=useState(0),[error,setError]=useState<string|null>(null);
 const {prefs,setPrefs}=usePrefs();
 useFocusEffect(useCallback(()=>{alive.current=true;session.current++;setFocused(true);return()=>{
   alive.current=false;session.current++;setFocused(false);setReady(false);
 };},[]));
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{session.current++;setReady(false);setAppActive(state==='active');});return()=>sub.remove();},[]);
 const go=(scene:string)=>router.push({pathname:'/moments/[scene]',params:{scene}});
 const shoot=async()=>{
   if(!camera.current||!ready||busy.current||!appActive)return;
   busy.current=true;const token=session.current;
   const valid=()=>alive.current&&token===session.current&&AppState.currentState==='active';
   setShooting(true);
   try{
     for(let n=prefs.timer;n>0;n--){if(!valid())return;setCountdown(n);await new Promise(resolve=>setTimeout(resolve,1000));}
     if(!valid())return;setCountdown(0);
     const result=await camera.current.takePictureAsync({quality:prefs.quality,exif:true,skipProcessing:false});
     if(!result?.uri||!result.width||!result.height)throw new Error('Camera không trả về ảnh hợp lệ');
     // A centered square matches the square viewfinder and the shared moment format.
     const side=Math.min(result.width,result.height);
     const cropped=await ImageManipulator.manipulateAsync(result.uri,[{crop:{originX:Math.floor((result.width-side)/2),originY:Math.floor((result.height-side)/2),width:side,height:side}}],
       {compress:prefs.quality,format:ImageManipulator.SaveFormat.JPEG});
     if(!valid())return;
     const saved=await keepPhoto(cropped.uri);
     if(valid())router.push({pathname:'/moments/[scene]',params:{scene:'edit',name:saved.name}});
   }catch(e){if(valid())Alert.alert('Không thể chụp',e instanceof Error?e.message:String(e));}
   finally{busy.current=false;setShooting(false);setCountdown(0);}
 };
 if(!permission)return <SafeAreaView style={s.center}><ActivityIndicator color={C.accent}/><Text style={s.muted}>Đang kiểm tra camera…</Text></SafeAreaView>;
 if(!permission.granted)return <SafeAreaView style={s.center}>
   <Text style={s.logo}>LUMA</Text><Text style={s.muted}>Cho phép camera để chụp khoảnh khắc vuông và gửi riêng cho bạn bè.</Text>
   <Action title={permission.canAskAgain?'Cho phép camera':'Mở cài đặt quyền'} onPress={()=>{void (permission.canAskAgain?requestPermission():Linking.openSettings());}}/>
   <Action title="Xem khoảnh khắc" secondary onPress={()=>go('inbox')}/>
 </SafeAreaView>;
 const renderToken=session.current;
 return <SafeAreaView style={s.page} edges={['top','bottom']}>
   <View style={s.header}><View><Text style={s.logo}>LUMA</Text><Text style={s.sub}>MOMENTS · CAMERA</Text></View>
     <View style={s.row}><Pressable style={s.smallButton} disabled={shooting} onPress={()=>setFlash(v=>flashModes[(flashModes.indexOf(v)+1)%3])}><Text style={s.buttonText}>⚡ {flash.toUpperCase()}</Text></Pressable>
       <Pressable style={s.smallButton} onPress={()=>go('widget')}><Text style={s.buttonText}>WIDGET</Text></Pressable></View></View>
   <View style={s.stage}><View style={s.viewfinder}>
     {focused&&appActive&&<CameraView key={facing} ref={camera} style={StyleSheet.absoluteFill} facing={facing} flash={flash} zoom={zoom}
       ratio="4:3" mode="picture" onCameraReady={()=>{if(renderToken===session.current&&alive.current){setReady(true);setError(null);}}}
       onMountError={e=>{setError(e.message);setReady(false);}}/>}
     {prefs.grid&&<View pointerEvents="none" style={StyleSheet.absoluteFill}>
       <View style={[s.vline,{left:'33.33%'}]}/><View style={[s.vline,{left:'66.66%'}]}/>
       <View style={[s.hline,{top:'33.33%'}]}/><View style={[s.hline,{top:'66.66%'}]}/></View>}
     {countdown>0&&<View style={s.overlay}><Text style={s.countdown}>{countdown}</Text></View>}
     {error&&<View style={s.overlay}><Text style={s.error}>{error}</Text></View>}
     {!ready&&!error&&<View style={s.spinner}><ActivityIndicator color={C.white}/></View>}
   </View></View>
   <Text style={s.hint}>Ảnh vuông · lưu trên máy trước khi gửi</Text>
   <View style={s.tools}><Pressable disabled={shooting} onPress={()=>{const timers=[0,3,5,10] as const;setPrefs({timer:timers[(timers.indexOf(prefs.timer)+1)%timers.length]});}}><Text style={s.tool}>◷ {prefs.timer?`${prefs.timer}s`:'TẮT'}</Text></Pressable>
     <Pressable disabled={shooting} onPress={()=>setZoom(z=>z>=0.7?0:Math.round((z+0.25)*100)/100)}><Text style={s.tool}>⌕ {(1+zoom*4).toFixed(1)}×*</Text></Pressable>
     <Pressable disabled={shooting} onPress={()=>{if(busy.current)return;session.current++;setReady(false);setFacing(v=>v==='back'?'front':'back');}}><Text style={s.tool}>↻ ĐỔI</Text></Pressable></View>
   <View style={s.shutterRow}><Pressable onPress={()=>router.push('/gallery')}><Text style={s.side}>▦</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh" disabled={!ready||shooting} onPress={()=>{void shoot();}} style={[s.shutter,!ready&&{opacity:.4}]}>
       <View style={s.shutterCore}>{shooting&&<ActivityIndicator color={C.bg}/>}</View></Pressable>
     <Pressable onPress={()=>go('inbox')}><Text style={s.side}>▣</Text></Pressable></View>
   <View style={s.nav}>{nav.map(item=><Pressable key={item.scene} onPress={()=>go(item.scene)} style={s.navItem}><Text style={s.navIcon}>{item.icon}</Text><Text style={s.navText}>{item.label}</Text></Pressable>)}</View>
 </SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,justifyContent:'center',alignItems:'center',gap:20,padding:26},muted:{color:C.muted,textAlign:'center',lineHeight:22},logo:{color:C.white,fontSize:24,fontWeight:'800',letterSpacing:5},sub:{color:C.accent,fontSize:9,letterSpacing:2.2},
 header:{height:70,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},row:{flexDirection:'row',gap:6},smallButton:{backgroundColor:C.surface,padding:9,borderRadius:10},buttonText:{color:C.white,fontSize:11,fontWeight:'700'},
 stage:{flex:1,justifyContent:'center',alignItems:'center'},viewfinder:{width:'100%',aspectRatio:1,backgroundColor:'#030405',overflow:'hidden'},vline:{position:'absolute',top:0,bottom:0,width:1,backgroundColor:'#FFFFFF66'},hline:{position:'absolute',left:0,right:0,height:1,backgroundColor:'#FFFFFF66'},overlay:{...StyleSheet.absoluteFill,justifyContent:'center',alignItems:'center',backgroundColor:'#0008'},countdown:{fontSize:82,color:C.white,fontWeight:'800'},error:{color:C.danger,textAlign:'center',padding:22},spinner:{position:'absolute',top:'50%',left:'50%'},hint:{color:C.dim,textAlign:'center',fontSize:11,marginVertical:9},
 tools:{flexDirection:'row',justifyContent:'space-around',paddingVertical:9},tool:{color:C.white,fontSize:12,fontWeight:'700'},shutterRow:{height:95,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},shutter:{height:78,width:78,borderRadius:40,borderColor:C.white,borderWidth:3,alignItems:'center',justifyContent:'center'},shutterCore:{height:62,width:62,borderRadius:32,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},side:{color:C.white,fontSize:27},
 nav:{borderTopWidth:1,borderColor:C.border,flexDirection:'row',paddingVertical:7},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{color:C.muted,fontSize:22},navText:{color:C.muted,fontSize:9,fontWeight:'700'},});
