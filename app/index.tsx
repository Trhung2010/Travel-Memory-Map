import React,{useCallback,useEffect,useRef,useState} from 'react';
import {CameraView,useCameraPermissions,type CameraType,type FlashMode} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import {useFocusEffect,useRouter} from 'expo-router';
import {ActivityIndicator,Alert,AppState,Linking,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Action,BottomNav,Chip} from '../src/components/Ui';
import {keepPhoto} from '../src/lib/gallery';
import {usePrefs} from '../src/state/Prefs';
import {C} from '../src/theme/colors';

const flashModes:FlashMode[]=['off','auto','on'];
export default function CameraScreen({mode='normal'}:{mode?:'normal'|'pro'}){
 const pro=mode==='pro';
 const router=useRouter();const camera=useRef<CameraView>(null);
 const {width}=useWindowDimensions();const [stageHeight,setStageHeight]=useState(width);
 const alive=useRef(false),session=useRef(0),busy=useRef(false);
 const [permission,requestPermission]=useCameraPermissions();
 const [focused,setFocused]=useState(false),[appActive,setAppActive]=useState(AppState.currentState==='active');
 const [facing,setFacing]=useState<CameraType>('back'),[flash,setFlash]=useState<FlashMode>('off');
 const [zoom,setZoom]=useState(0),[focusLocked,setFocusLocked]=useState(false),[ready,setReady]=useState(false),[shooting,setShooting]=useState(false);
 const [proControlsOpen,setProControlsOpen]=useState(false);
 const [countdown,setCountdown]=useState(0),[error,setError]=useState<string|null>(null);
 const {prefs,setPrefs}=usePrefs();
 useFocusEffect(useCallback(()=>{alive.current=true;session.current++;setFocused(true);setProControlsOpen(false);return()=>{
   alive.current=false;session.current++;setFocused(false);setReady(false);
 };},[]));
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{session.current++;setReady(false);setAppActive(state==='active');});return()=>sub.remove();},[]);
 const go=(scene:string)=>router.push({pathname:'/studio/[scene]',params:{scene}});
 const switchFacing=()=>{if(busy.current)return;session.current++;setReady(false);setFacing(v=>v==='back'?'front':'back');};
 const shoot=async()=>{
   if(!camera.current||!ready||busy.current||!appActive)return;
   setProControlsOpen(false);
   busy.current=true;const token=session.current;
   const valid=()=>alive.current&&token===session.current&&AppState.currentState==='active';
   setShooting(true);
   try{
     for(let n=prefs.timer;n>0;n--){if(!valid())return;setCountdown(n);await new Promise(resolve=>setTimeout(resolve,1000));}
     if(!valid())return;setCountdown(0);
     const result=await camera.current.takePictureAsync({quality:prefs.quality,exif:true,skipProcessing:false});
     if(!result?.uri||!result.width||!result.height)throw new Error('Camera không trả về ảnh hợp lệ');
     // A centered square matches the viewfinder; the original camera result stays in cache only.
     const side=Math.min(result.width,result.height);
     const cropped=await ImageManipulator.manipulateAsync(result.uri,[{crop:{originX:Math.floor((result.width-side)/2),originY:Math.floor((result.height-side)/2),width:side,height:side}}],
       {compress:prefs.quality,format:ImageManipulator.SaveFormat.JPEG});
     if(!valid())return;
     const saved=await keepPhoto(cropped.uri);
     if(valid())router.push({pathname:'/studio/[scene]',params:{scene:'review',name:saved.name}});
   }catch(e){if(valid())Alert.alert('Không thể chụp',e instanceof Error?e.message:String(e));}
   finally{busy.current=false;setShooting(false);setCountdown(0);}
 };
 if(!permission)return <SafeAreaView style={s.center}><ActivityIndicator color={C.accent}/><Text style={s.muted}>Đang kiểm tra camera…</Text></SafeAreaView>;
 if(!permission.granted)return <SafeAreaView style={s.center}>
   <Text style={s.logo}>LUMA</Text><Text style={s.muted}>Cho phép camera để chụp ảnh và lưu trong LUMA trên thiết bị.</Text>
   <Action title={permission.canAskAgain?'Cho phép camera':'Mở cài đặt quyền'} onPress={()=>{void (permission.canAskAgain?requestPermission():Linking.openSettings());}}/>
   <Action title="Mở thư viện" secondary onPress={()=>go('library')}/>
 </SafeAreaView>;
 const renderToken=session.current;
 return <SafeAreaView style={s.page} edges={['top','bottom']}>
   <View style={s.header}><View><Text style={s.logo}>LUMA</Text><Text style={s.sub}>{pro?'CHỤP PRO':'CHỤP THƯỜNG'}</Text></View>
     {!pro&&<View style={s.row}><Pressable accessibilityRole="button" style={s.smallButton} disabled={shooting} onPress={()=>setFlash(v=>flashModes[(flashModes.indexOf(v)+1)%3])}><Text style={s.buttonText}>Flash: {flash==='off'?'Tắt':flash==='auto'?'Tự động':'Bật'}</Text></Pressable></View>}</View>
   <View style={s.stage} onLayout={event=>setStageHeight(event.nativeEvent.layout.height)}><View style={[s.viewfinder,{width:Math.min(width,Math.max(120,stageHeight))}]}>
     {focused&&appActive&&<CameraView key={facing} ref={camera} style={StyleSheet.absoluteFill} facing={facing} flash={flash} zoom={zoom} autofocus={focusLocked?'on':'off'}
       ratio="4:3" mode="picture" onCameraReady={()=>{if(renderToken===session.current&&alive.current){setReady(true);setError(null);}}}
       onMountError={e=>{setError(e.message);setReady(false);}}/>}
     {prefs.grid&&<View pointerEvents="none" style={StyleSheet.absoluteFill}>
       <View style={[s.vline,{left:'33.33%'}]}/><View style={[s.vline,{left:'66.66%'}]}/>
       <View style={[s.hline,{top:'33.33%'}]}/><View style={[s.hline,{top:'66.66%'}]}/></View>}
     {countdown>0&&<View style={s.overlay}><Text style={s.countdown}>{countdown}</Text></View>}
     {error&&<View style={s.overlay}><Text style={s.error}>{error}</Text></View>}
     {!ready&&!error&&<View style={s.spinner}><ActivityIndicator color={C.white}/></View>}
   </View>
   {pro&&!proControlsOpen&&<Pressable accessibilityRole="button" accessibilityLabel="Mở điều khiển Pro" style={s.proTab} onPress={()=>setProControlsOpen(true)}>
     <Text style={s.proTabIcon}>☷</Text><Text style={s.proTabText}>PRO</Text></Pressable>}
   {pro&&proControlsOpen&&<View style={[s.proDrawer,{width:Math.min(280,width*.74)}]}>
     <Pressable accessibilityRole="button" accessibilityLabel="Đóng điều khiển Pro" style={s.proClose} onPress={()=>setProControlsOpen(false)}><Text style={s.proCloseText}>Đóng ×</Text></Pressable>
     <ScrollView contentContainerStyle={s.proContent} showsVerticalScrollIndicator={false}>
       <Text style={s.proTitle}>FLASH</Text><View style={s.proChips}>{flashModes.map(v=><Chip key={v} title={v==='off'?'Tắt':v==='auto'?'Tự động':'Bật'} active={flash===v} onPress={()=>setFlash(v)}/>)}</View>
       <Text style={s.proTitle}>ZOOM</Text><View style={s.proChips}>{[0,.25,.5,.75,1].map(v=><Chip key={v} title={`${Math.round(v*100)}%`} active={zoom===v} onPress={()=>setZoom(v)}/>)}</View>
       <Text style={s.proHint}>Phần trăm phạm vi camera; không phải zoom quang học.</Text>
       <Text style={s.proTitle}>HẸN GIỜ</Text><View style={s.proChips}>{([0,3,5,10] as const).map(v=><Chip key={v} title={v?`${v} giây`:'Tắt'} active={prefs.timer===v} onPress={()=>setPrefs({timer:v})}/>)}</View>
       <Text style={s.proTitle}>LẤY NÉT</Text><View style={s.proChips}><Chip title={focusLocked?'Khóa':'Tự động'} active={focusLocked} onPress={()=>setFocusLocked(v=>!v)}/></View>
       <Text style={s.proTitle}>KHUNG NGẮM</Text><View style={s.proChips}><Chip title={prefs.grid?'Lưới bật':'Lưới tắt'} active={prefs.grid} onPress={()=>setPrefs({grid:!prefs.grid})}/></View>
       <Text style={s.proTitle}>CHẤT LƯỢNG JPEG</Text><View style={s.proChips}>{[.85,.95,1].map(v=><Chip key={v} title={`${Math.round(v*100)}%`} active={prefs.quality===v} onPress={()=>setPrefs({quality:v})}/>)}</View>
       <Text style={s.proTitle}>CAMERA</Text><View style={s.proChips}><Chip title={facing==='back'?'Sau':'Trước'} active={false} onPress={switchFacing}/></View>
     </ScrollView>
   </View>}
   </View>
   <Text style={s.hint}>Ảnh vuông · lưu trong LUMA trên thiết bị</Text>
   <View style={s.modeRow}><Chip title="Chụp thường" active={!pro} onPress={()=>router.replace('/')}/><Chip title="Chụp Pro" active={pro} onPress={()=>go('pro-camera')}/></View>
   {!pro&&<View style={s.tools}><Pressable accessibilityRole="button" style={s.toolButton} disabled={shooting} onPress={()=>{const timers=[0,3,5,10] as const;setPrefs({timer:timers[(timers.indexOf(prefs.timer)+1)%timers.length]});}}><Text style={s.tool}>Hẹn giờ {prefs.timer?`${prefs.timer}s`:'tắt'}</Text></Pressable>
     <Pressable accessibilityRole="button" style={s.toolButton} disabled={shooting} onPress={switchFacing}><Text style={s.tool}>Đổi camera</Text></Pressable></View>}
   <View style={s.shutterRow}><Pressable accessibilityRole="button" accessibilityLabel="Mở thư viện" onPress={()=>go('library')}><Text style={s.side}>▦</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh" disabled={!ready||shooting} onPress={()=>{void shoot();}} style={[s.shutter,!ready&&{opacity:.4}]}>
       <View style={s.shutterCore}>{shooting&&<ActivityIndicator color={C.bg}/>}</View></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Mở bộ lọc" onPress={()=>go('filters')}><Text style={s.side}>◐</Text></Pressable></View>
   <BottomNav active="camera" navigate={target=>target==='camera'?router.replace('/'):go(target)}/>
 </SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,justifyContent:'center',alignItems:'center',gap:20,padding:26},muted:{color:C.muted,textAlign:'center',lineHeight:22},logo:{color:C.white,fontSize:24,fontWeight:'800',letterSpacing:5},sub:{color:C.accent,fontSize:9,letterSpacing:2.2},
 header:{height:70,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:C.border},row:{flexDirection:'row',gap:6},smallButton:{backgroundColor:C.surface,padding:10,borderRadius:10,minHeight:44,justifyContent:'center'},buttonText:{color:C.white,fontSize:11,fontWeight:'700'},
 stage:{flex:1,minHeight:120,position:'relative',justifyContent:'center',alignItems:'center'},viewfinder:{aspectRatio:1,backgroundColor:C.surface,overflow:'hidden'},vline:{position:'absolute',top:0,bottom:0,width:1,backgroundColor:'#FFFFFF66'},hline:{position:'absolute',left:0,right:0,height:1,backgroundColor:'#FFFFFF66'},overlay:{...StyleSheet.absoluteFill,justifyContent:'center',alignItems:'center',backgroundColor:'#0008'},countdown:{fontSize:82,color:C.white,fontWeight:'800'},error:{color:C.danger,textAlign:'center',padding:22},spinner:{position:'absolute',top:'50%',left:'50%'},hint:{color:C.dim,textAlign:'center',fontSize:11,marginVertical:9},
 modeRow:{flexDirection:'row',justifyContent:'center',paddingVertical:6,paddingHorizontal:12},tools:{flexDirection:'row',justifyContent:'space-around',paddingVertical:7},toolButton:{minHeight:44,justifyContent:'center',paddingHorizontal:12},tool:{color:C.white,fontSize:12,fontWeight:'700'},
 proTab:{position:'absolute',right:0,top:'35%',minWidth:48,minHeight:72,backgroundColor:C.surface,borderTopLeftRadius:12,borderBottomLeftRadius:12,borderWidth:1,borderRightWidth:0,borderColor:C.accent,justifyContent:'center',alignItems:'center',zIndex:2},
 proTabIcon:{color:C.accent,fontSize:22},proTabText:{color:C.white,fontSize:10,fontWeight:'800'},
 proDrawer:{position:'absolute',right:0,top:0,bottom:0,backgroundColor:C.surface,borderLeftWidth:1,borderColor:C.accent,zIndex:3},
 proClose:{height:48,paddingHorizontal:16,alignItems:'flex-end',justifyContent:'center',borderBottomWidth:1,borderBottomColor:C.border},proCloseText:{color:C.accent,fontSize:14,fontWeight:'700'},
 proContent:{padding:12,gap:9,paddingBottom:24},proTitle:{color:C.accent,fontSize:10,fontWeight:'800',letterSpacing:1.5,marginTop:4},proChips:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:4},proHint:{color:C.muted,fontSize:10,lineHeight:15},
 shutterRow:{height:90,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},shutter:{height:78,width:78,borderRadius:40,borderColor:C.white,borderWidth:3,alignItems:'center',justifyContent:'center'},shutterCore:{height:62,width:62,borderRadius:32,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},side:{color:C.white,fontSize:27},});
