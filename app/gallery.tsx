import React, {useCallback, useState} from 'react';
import {useFocusEffect, useRouter} from 'expo-router';
import {FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScreenHeader} from '../src/components/Ui';
import {listPhotos,type GalleryPhoto} from '../src/lib/gallery';
import {C} from '../src/theme/colors';

export default function Gallery(){
 const router=useRouter();const [photos,setPhotos]=useState<GalleryPhoto[]>([]);const {width}=useWindowDimensions();
 useFocusEffect(useCallback(()=>{try{setPhotos(listPhotos())}catch(e){console.warn('gallery',e)}},[]));
 const size=(width-32)/3;
 return <SafeAreaView style={styles.screen}><ScreenHeader title="LIBRARY" back={()=>router.back()} trailing={<Text style={styles.count}>{photos.length} ảnh</Text>}/>
 {photos.length===0?<View style={styles.empty}><Text style={styles.emptyIcon}>▧</Text><Text style={styles.emptyTitle}>Chưa có ảnh</Text><Text style={styles.emptyText}>Ảnh chụp trong LUMA được lưu offline và sẽ xuất hiện ở đây.</Text></View>:
 <FlatList data={photos} keyExtractor={item=>item.name} numColumns={3} contentContainerStyle={{padding:6,paddingBottom:30}}
 renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Xem ảnh ${item.name}`} onPress={()=>router.push({pathname:'/photo/[name]',params:{name:item.name}})}>
 <Image source={{uri:item.uri}} style={{width:size,height:size,margin:3,borderRadius:4,backgroundColor:C.surface}} resizeMode="cover"/>
 </Pressable>}/>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:C.bg},count:{color:C.muted,fontSize:12},empty:{flex:1,alignItems:'center',justifyContent:'center',padding:36,gap:12},emptyIcon:{fontSize:62,color:C.dim},emptyTitle:{color:C.white,fontSize:20,fontWeight:'700'},emptyText:{color:C.muted,fontSize:13,lineHeight:21,textAlign:'center'}});
