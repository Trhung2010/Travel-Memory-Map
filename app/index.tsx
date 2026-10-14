import React, {useCallback, useRef, useState} from 'react';
import {CameraView, useCameraPermissions, type CameraType, type FlashMode} from 'expo-camera';
import {useFocusEffect, useRouter} from 'expo-router';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Action, Chip} from '../src/components/Ui';
import {keepPhoto} from '../src/lib/gallery';
import {usePrefs} from '../src/state/Prefs';
import {C} from '../src/theme/colors';

const flashModes:FlashMode[]=['off','auto','on'];
export default function CameraScreen(){
  const router=useRouter();
  const camera=useRef<CameraView>(null);
  const alive=useRef(false);
  const [permission,requestPermission]=useCameraPermissions();
  const [focused,setFocused]=useState(true);
  const [facing,setFacing]=useState<CameraType>('back');
  const [flash,setFlash]=useState<FlashMode>('off');
  const [zoom,setZoom]=useState(0);
  const [pro,setPro]=useState(false);
  const [ready,setReady]=useState(false);
  const [shooting,setShooting]=useState(false);
  const [countdown,setCountdown]=useState(0);
  const [error,setError]=useState<string|null>(null);
  const [sizes,setSizes]=useState<string[]>([]);
  const [pictureSize,setPictureSize]=useState<string|undefined>(undefined);
  const {prefs,setPrefs}=usePrefs();

  useFocusEffect(useCallback(()=>{
    alive.current=true;setFocused(true);
    return ()=>{alive.current=false;setFocused(false);setReady(false)};
  },[]));

  const fetchSizes=async()=>{
    setReady(true);setError(null);
    try {
      const list=await camera.current?.getAvailablePictureSizesAsync();
      if(list) setSizes(list.filter(s=>/^\d+x\d+$/.test(s)).sort((a,b)=>{
        const area=(s:string)=>s.split('x').map(Number).reduce((x,y)=>x*y,1);
        return area(b)-area(a);
      }).slice(0,6));
    }catch(e){console.warn('No sizes returned',e)}
  };
  const shoot=async()=>{
    if(!camera.current||!ready||shooting)return;
    setShooting(true);
    try{
      for(let s=prefs.timer;s>0;s--){
        if(!alive.current)return;
        setCountdown(s);
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
      if(!alive.current)return;
      setCountdown(0);
      const result=await camera.current.takePictureAsync({quality:prefs.quality,exif:true,skipProcessing:false});
      if(!result?.uri)throw new Error('Camera không trả về file ảnh');
      const saved=await keepPhoto(result.uri);
      if(alive.current)router.push({pathname:'/photo/[name]',params:{name:saved.name}});
    }catch(e){Alert.alert('Không thể chụp',e instanceof Error?e.message:String(e))}
    finally{setShooting(false);setCountdown(0)}
  };
  if(!permission)return <SafeAreaView style={styles.center}><ActivityIndicator color={C.accent}/><Text style={styles.muted}>Đang kiểm tra quyền Camera...</Text></SafeAreaView>;
  if(!permission.granted)return <SafeAreaView style={styles.center}>
    <Text style={styles.large}>LUMA CAMERA</Text><Text style={styles.muted}>Ứng dụng cần quyền camera để chụp ảnh. Mọi ảnh được lưu offline trên thiết bị.</Text>
    <Action title="Cho phép truy cập Camera" onPress={()=>{void requestPermission()}}/>
    {!permission.canAskAgain&&<Text style={styles.muted}>Quyền đã bị từ chối. Hãy mở Cài đặt Android → Ứng dụng → LUMA → Quyền.</Text>}
  </SafeAreaView>;
  return <SafeAreaView style={styles.page} edges={['top','bottom']}>
    <View style={styles.top}>
      <View><Text style={styles.brand}>LUMA</Text><Text style={styles.subtitle}>{pro?'PRO ASSIST':'PHOTO'}</Text></View>
      <View style={styles.row}>
        <Pressable style={styles.topButton} onPress={()=>setFlash(x=>flashModes[(flashModes.indexOf(x)+1)%3])}><Text style={styles.topText}>⚡ {flash.toUpperCase()}</Text></Pressable>
        <Pressable style={styles.topButton} onPress={()=>router.push('/settings')}><Text style={styles.topText}>⚙</Text></Pressable>
      </View>
    </View>
    <View style={styles.viewfinder}>
      {focused && <CameraView ref={camera} style={StyleSheet.absoluteFillObject} facing={facing} flash={flash} zoom={zoom}
        ratio="4:3" pictureSize={pictureSize} mode="picture" onCameraReady={()=>{void fetchSizes()}}
        onMountError={event=>{setError(event.message);setReady(false)}} />}
      {prefs.grid&&<View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.vLine,{left:'33.33%'}]}/><View style={[styles.vLine,{left:'66.66%'}]}/>
        <View style={[styles.hLine,{top:'33.33%'}]}/><View style={[styles.hLine,{top:'66.66%'}]}/>
      </View>}
      <View pointerEvents="none" style={styles.zoomBadge}><Text style={styles.zoomBadgeText}>{(1+zoom*4).toFixed(1)}x*</Text></View>
      {countdown>0&&<View style={styles.counter}><Text style={styles.counterText}>{countdown}</Text></View>}
      {error&&<View style={styles.counter}><Text style={styles.error}>{error}</Text></View>}
      {!ready&&!error&&<View style={styles.ready}><ActivityIndicator color={C.white}/></View>}
    </View>
    <View style={styles.controls}>
      <View style={[styles.row,{justifyContent:'center',paddingVertical:10}]}>
        <Chip title="PHOTO" active={!pro} onPress={()=>setPro(false)}/>
        <Chip title="PRO ASSIST" active={pro} onPress={()=>setPro(true)}/>
      </View>
      {pro?<View style={styles.proControls}>
        <View style={styles.settingRow}><Text style={styles.label}>ZOOM</Text>
          {[-0.01,0,0.12,0.25,0.5,0.75].filter(n=>n>=0).map(n=><Pressable key={n} onPress={()=>setZoom(n)}><Text style={[styles.zoomOption,Math.abs(zoom-n)<0.01&&{color:C.accent}]}>{(1+n*4).toFixed(1)}</Text></Pressable>)}
        </View>
        <View style={styles.settingRow}><Text style={styles.label}>TIMER</Text>
          {([0,3,5,10] as const).map(n=><Pressable key={n} onPress={()=>setPrefs({timer:n})}><Text style={[styles.zoomOption,prefs.timer===n&&{color:C.accent}]}>{n===0?'OFF':`${n}s`}</Text></Pressable>)}
        </View>
        <View style={styles.settingRow}><Text style={styles.label}>SIZE</Text>
          <Pressable onPress={()=>{
            if(!sizes.length){Alert.alert('Không có thông tin','Thiết bị chưa công bố kích thước ảnh');return;}
            const all=[undefined,...sizes];const index=all.indexOf(pictureSize);setReady(false);setPictureSize(all[(index+1)%all.length]);
          }}><Text style={styles.zoomOption}>{pictureSize||'AUTO'} {sizes.length?'›':''}</Text></Pressable>
        </View>
        <Text style={styles.note}>* Zoom là giá trị điều khiển tương đối, không bảo đảm độ phóng đại quang học.</Text>
      </View>:<Text style={styles.modeNote}>Ảnh gốc giữ nguyên • preset áp sau khi chụp</Text>}
      <View style={styles.bottom}>
        <Pressable style={styles.side} onPress={()=>router.push('/gallery')}><Text style={styles.symbol}>▦</Text><Text style={styles.small}>GALLERY</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh" disabled={!ready||shooting} onPress={()=>{void shoot()}} style={[styles.shutterOuter,(!ready||shooting)&&{opacity:.5}]}>
          <View style={styles.shutterInner}>{shooting&&<ActivityIndicator color={C.bg}/>}</View>
        </Pressable>
        <Pressable style={styles.side} onPress={()=>{setReady(false);setFacing(v=>v==='back'?'front':'back');setPictureSize(undefined)}}><Text style={styles.symbol}>↻</Text><Text style={styles.small}>FLIP</Text></Pressable>
      </View>
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:20,padding:28},large:{color:C.white,fontSize:26,fontWeight:'800',letterSpacing:4},muted:{color:C.muted,textAlign:'center',lineHeight:22},
  top:{height:60,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:22},brand:{color:C.white,fontSize:22,fontWeight:'800',letterSpacing:5},subtitle:{color:C.accent,fontSize:9,letterSpacing:2.8,marginTop:2},row:{flexDirection:'row',alignItems:'center',gap:8},topButton:{backgroundColor:C.surface,paddingVertical:9,paddingHorizontal:13,borderRadius:10},topText:{color:C.white,fontSize:13},
  viewfinder:{flex:1,marginHorizontal:8,backgroundColor:'#050608',overflow:'hidden',borderRadius:8},vLine:{position:'absolute',top:0,bottom:0,width:1,backgroundColor:'#FFFFFF55'},hLine:{position:'absolute',left:0,right:0,height:1,backgroundColor:'#FFFFFF55'},zoomBadge:{position:'absolute',left:16,bottom:16,backgroundColor:'#0009',paddingVertical:7,paddingHorizontal:12,borderRadius:20},zoomBadgeText:{color:C.white,fontSize:12,fontWeight:'700'},counter:{...StyleSheet.absoluteFillObject,justifyContent:'center',alignItems:'center',backgroundColor:'#0007'},counterText:{fontSize:84,fontWeight:'800',color:C.white},ready:{position:'absolute',top:'50%',left:'50%'},error:{color:C.danger,textAlign:'center',padding:20},
  controls:{paddingHorizontal:15,paddingBottom:9},proControls:{borderTopWidth:1,borderColor:C.border,paddingTop:8},settingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8},label:{color:C.muted,fontSize:10,letterSpacing:1.2,fontWeight:'700',width:54},zoomOption:{color:C.white,fontSize:12,fontWeight:'700',paddingHorizontal:6},note:{color:C.dim,fontSize:10,textAlign:'center',paddingTop:5},modeNote:{color:C.dim,textAlign:'center',paddingVertical:8,fontSize:11},bottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingTop:8},side:{width:80,alignItems:'center',justifyContent:'center',gap:2},symbol:{color:C.white,fontSize:29},small:{fontSize:9,letterSpacing:1.5,color:C.muted},shutterOuter:{width:83,height:83,borderRadius:43,borderWidth:3,borderColor:C.white,alignItems:'center',justifyContent:'center'},shutterInner:{width:67,height:67,borderRadius:34,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},
});
