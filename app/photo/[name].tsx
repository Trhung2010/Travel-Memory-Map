import React, {useCallback, useState} from 'react';
import {useFocusEffect, useLocalSearchParams, useRouter} from 'expo-router';
import {Alert, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import {Action, ScreenHeader} from '../../src/components/Ui';
import {fileFor,removePhoto} from '../../src/lib/gallery';
import {C} from '../../src/theme/colors';

export default function Photo(){
  const {name}=useLocalSearchParams<{name:string}>();const router=useRouter();
  const [photo,setPhoto]=useState<{uri:string;size:number}|null>(null);
  const [exporting,setExporting]=useState(false);
  const [,requestWritePermission]=MediaLibrary.usePermissions({writeOnly:true,granularPermissions:['photo']});
  useFocusEffect(useCallback(()=>{
    try{const f=fileFor(name);setPhoto(f.exists?{uri:f.uri,size:f.size}:null)}catch{setPhoto(null)}
  },[name]));
  const deleteNow=()=>Alert.alert('Xóa ảnh?','Ảnh sẽ bị xóa vĩnh viễn khỏi dữ liệu nội bộ LUMA. Ảnh đã xuất ra thư viện Android không bị xóa.',[
    {text:'Hủy',style:'cancel'}, {text:'Xóa',style:'destructive',onPress:()=>{
      try{removePhoto(name);router.replace('/gallery')}catch(e){Alert.alert('Xóa thất bại',String(e))}
    }}
  ]);
  const exportPhoto=async()=>{
    if(!photo||exporting)return;setExporting(true);
    try{const permit=await requestWritePermission();if(!permit.granted){Alert.alert('Thiếu quyền','Cần quyền ghi ảnh để xuất sang Gallery Android.');return;}
      await MediaLibrary.Asset.create(photo.uri);Alert.alert('Đã xuất ảnh','Đã lưu một bản sao vào thư viện hệ thống.');
    }catch(e){Alert.alert('Không thể xuất',String(e))}finally{setExporting(false)}
  };
  return <SafeAreaView style={styles.screen}><ScreenHeader title="PHOTO VIEWER" back={()=>router.back()}/>
  {photo?<>
    <Image source={{uri:photo.uri}} resizeMode="contain" style={styles.image}/>
    <View style={styles.meta}><Text style={styles.file} numberOfLines={2}>{name}</Text><Text style={styles.size}>{(photo.size/1048576).toFixed(2)} MB · JPEG</Text></View>
    <View style={styles.actions}>
      <Action title="Chia sẻ Moments" onPress={()=>router.push({pathname:'/moments/[scene]',params:{scene:'edit',name}})} style={{flex:1}}/>
      <Action title="Tô màu" onPress={()=>router.push({pathname:'/presets',params:{name}})} style={{flex:1}}/>
      <Action title={exporting?'Đang xuất...':'Xuất Android'} onPress={()=>{void exportPhoto()}} secondary disabled={exporting} style={{flex:1}}/>
    </View>
    <Pressable onPress={deleteNow} style={styles.delete}><Text style={styles.deleteText}>Xóa ảnh khỏi LUMA</Text></Pressable>
  </>:<View style={styles.empty}><Text style={styles.file}>Không tìm thấy ảnh. Có thể ảnh đã bị xóa.</Text><Action title="Mở thư viện" onPress={()=>router.replace('/gallery')}/></View>}
  </SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:C.bg},image:{flex:1,marginHorizontal:5,backgroundColor:'#07080B'},meta:{paddingHorizontal:22,paddingTop:17,gap:5},file:{color:C.white,fontSize:13},size:{color:C.muted,fontSize:12},actions:{flexDirection:'row',gap:9,paddingHorizontal:17,paddingTop:20},delete:{alignItems:'center',paddingVertical:24},deleteText:{color:C.danger,fontWeight:'600'},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:22,padding:20}});
