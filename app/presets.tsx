import React, {useMemo, useState} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Canvas, ColorMatrix, FilterMode, Image as SkImageView, ImageFormat, MipmapMode, Skia, rect, useImage} from '@shopify/react-native-skia';
import * as ImageManipulator from 'expo-image-manipulator';
import {File} from 'expo-file-system';
import {Action, Chip, ScreenHeader} from '../src/components/Ui';
import {derivedName,fileFor} from '../src/lib/gallery';
import {matrixAt,PRESETS} from '../src/lib/presets';
import {C} from '../src/theme/colors';

const MAX_OUTPUT_EDGE=2048;
export default function PresetStudio(){
  const {name}=useLocalSearchParams<{name:string}>();const router=useRouter();
  const [selected,setSelected]=useState('hassel-natural');
  const [intensity,setIntensity]=useState(1);
  const [compare,setCompare]=useState(false);
  const [saving,setSaving]=useState(false);
  const {width}=useWindowDimensions();
  let uri:string|undefined;
  try{const f=fileFor(name);if(f.exists)uri=f.uri;}catch{}
  const image=useImage(uri??null);
  const current=PRESETS.find(x=>x.id===selected)??PRESETS[0];
  const matrix=useMemo(()=>matrixAt(current,compare?0:intensity),[current,compare,intensity]);
  const previewWidth=width-20;
  const aspect=image?image.height()/image.width():1.33;
  const previewHeight=Math.max(200,Math.min(480,previewWidth*aspect));

  const save=async()=>{
    if(!image||!uri||saving)return;
    setSaving(true);
    try{
      // Resize if needed before creating a GPU surface to avoid running out of memory.
      // Original full-resolution source is never modified or deleted.
      const w=image.width(),h=image.height();
      let sourceUri=uri;
      if(Math.max(w,h)>MAX_OUTPUT_EDGE){
        const scale=MAX_OUTPUT_EDGE/Math.max(w,h);
        const output=await ImageManipulator.manipulateAsync(uri,[{resize:{width:Math.round(w*scale),height:Math.round(h*scale)}}],
          {compress:0.97,format:ImageManipulator.SaveFormat.JPEG});
        sourceUri=output.uri;
      }
      const source=await new File(sourceUri).bytes();
      const skImage=Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(source));
      if(!skImage)throw new Error('Không giải mã được JPEG để áp màu');
      const sw=skImage.width(),sh=skImage.height();
      const surface=Skia.Surface.MakeOffscreen(sw,sh);
      if(!surface)throw new Error('Thiết bị không tạo được GPU surface');
      const paint=Skia.Paint();
      paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrixAt(current,intensity)));
      surface.getCanvas().drawImageRectOptions(skImage,rect(0,0,sw,sh),rect(0,0,sw,sh),FilterMode.Linear,MipmapMode.Linear,paint);
      surface.flush();
      const snapshot=surface.makeImageSnapshot();
      if(!snapshot)throw new Error('Không thể xuất ảnh từ GPU');
      const bytes=snapshot.encodeToBytes(ImageFormat.JPEG,94);
      const outputName=derivedName(name,current.id);
      const out=fileFor(outputName);
      out.create();out.write(bytes);
      Alert.alert('Đã lưu preset',`Ảnh mới: ${sw} × ${sh} px. Ảnh gốc vẫn được giữ.`,
        [{text:'Xem ảnh',onPress:()=>router.replace({pathname:'/photo/[name]',params:{name:outputName}})}]);
    }catch(e){Alert.alert('Xử lý màu thất bại',e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  };
  return <SafeAreaView style={styles.screen}><ScreenHeader title="COLOR STUDIO" back={()=>router.back()}/>
    <View style={styles.topLabel}><Text style={styles.label}>INSPIRED COLOR SCIENCE</Text><Pressable onPress={()=>setCompare(v=>!v)} style={styles.compare}><Text style={styles.compareText}>{compare?'Đang xem GỐC':'Giữ để so sánh: bật/tắt'}</Text></Pressable></View>
    <View style={styles.canvasWrap}>
      {image?<Canvas style={{width:previewWidth,height:previewHeight}}>
        <SkImageView image={image} x={0} y={0} width={previewWidth} height={previewHeight} fit="contain">
          <ColorMatrix matrix={matrix}/>
        </SkImageView>
      </Canvas>:<View style={[styles.empty,{height:previewHeight}]}><ActivityIndicator color={C.accent}/><Text style={styles.muted}>{uri?'Đang mở ảnh...':'Không tìm thấy ảnh'}</Text></View>}
    </View>
    <View style={styles.detail}><Text style={styles.presetTitle}>{current.label}</Text><Text style={styles.muted}>{current.subtitle}</Text></View>
    <Text style={styles.intensity}>CƯỜNG ĐỘ MÀU    {Math.round(intensity*100)}%</Text>
    <View style={styles.intensityRow}>{[0,0.25,0.5,0.75,1].map(n=><Pressable key={n} onPress={()=>setIntensity(n)} style={[styles.step,Math.abs(intensity-n)<0.01&&styles.activeStep]}><Text style={[styles.stepText,Math.abs(intensity-n)<0.01&&{color:C.bg}]}>{Math.round(n*100)}</Text></Pressable>)}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
      {PRESETS.map(p=><Chip key={p.id} title={p.label} active={selected===p.id} onPress={()=>{setSelected(p.id);setCompare(false)}}/>)}
    </ScrollView>
    <View style={styles.bottom}><Action title={saving?'Đang xử lý...':'Lưu thành ảnh mới'} onPress={()=>{void save()}} disabled={!image||saving}/>
      <Text style={styles.warning}>Preset là mô phỏng, không phải LUT chính hãng. Ảnh xử lý giới hạn cạnh dài 2.048 px; ảnh gốc được bảo toàn.</Text>
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:C.bg},topLabel:{height:46,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:17},label:{color:C.muted,fontSize:10,letterSpacing:1.7},compare:{paddingVertical:10},compareText:{color:C.accent,fontSize:11},canvasWrap:{alignItems:'center',justifyContent:'center',minHeight:200,flex:1},empty:{alignItems:'center',justifyContent:'center',gap:10},muted:{color:C.muted,fontSize:12},detail:{alignItems:'center',paddingTop:5,gap:5},presetTitle:{color:C.white,fontSize:23,fontWeight:'700'},intensity:{color:C.muted,fontSize:10,letterSpacing:2,marginHorizontal:20,marginTop:15,marginBottom:10},intensityRow:{flexDirection:'row',gap:7,paddingHorizontal:17},step:{flex:1,paddingVertical:10,alignItems:'center',backgroundColor:C.elevated,borderRadius:8},activeStep:{backgroundColor:C.accent},stepText:{fontSize:11,color:C.white,fontWeight:'700'},presetRow:{paddingHorizontal:17,paddingVertical:15,alignItems:'center'},bottom:{paddingHorizontal:18,paddingBottom:10,gap:9},warning:{color:C.dim,fontSize:10,textAlign:'center',lineHeight:15}});
