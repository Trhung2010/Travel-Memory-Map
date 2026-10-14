import React from 'react';
import {useRouter} from 'expo-router';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Chip, ScreenHeader} from '../src/components/Ui';
import {usePrefs} from '../src/state/Prefs';
import {C} from '../src/theme/colors';

export default function Settings(){const router=useRouter();const {prefs,setPrefs}=usePrefs();
return <SafeAreaView style={styles.screen}><ScreenHeader title="SETTINGS" back={()=>router.back()}/>
<ScrollView contentContainerStyle={styles.scroll}>
 <Text style={styles.heading}>KHUNG NGẮM</Text>
 <View style={styles.item}><View style={{flex:1}}><Text style={styles.title}>Lưới bố cục 3 × 3</Text><Text style={styles.muted}>Giúp căn đường chân trời và bố cục</Text></View>
 <Switch value={prefs.grid} onValueChange={v=>setPrefs({grid:v})} trackColor={{true:C.accent,false:C.elevated}} thumbColor={C.white}/></View>
 <Text style={styles.heading}>CHỤP ẢNH</Text>
 <View style={styles.itemColumn}><Text style={styles.title}>Hẹn giờ mặc định</Text><View style={styles.row}>{([0,3,5,10] as const).map(n=><Chip key={n} active={prefs.timer===n} title={n===0?'TẮT':`${n} GIÂY`} onPress={()=>setPrefs({timer:n})}/>)}</View></View>
 <View style={styles.itemColumn}><Text style={styles.title}>Chất lượng nén JPEG</Text><Text style={styles.muted}>Không ảnh hưởng khả năng HDR/RAW của camera.</Text><View style={styles.row}>{[0.85,0.95,1].map(n=><Chip key={n} active={prefs.quality===n} title={`${Math.round(n*100)}%`} onPress={()=>setPrefs({quality:n})}/>)}</View></View>
 <Text style={styles.heading}>DỮ LIỆU</Text>
 <View style={styles.itemColumn}><Text style={styles.title}>Ảnh được lưu offline</Text><Text style={styles.muted}>File ảnh nằm trong vùng Documents của LUMA. Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng có thể làm mất ảnh chưa xuất ra Gallery Android.</Text></View>
 <View style={styles.itemColumn}><Text style={styles.title}>Xuất ra thư viện Android</Text><Text style={styles.muted}>Mở ảnh trong Gallery của LUMA và chọn “Xuất Android”. Việc xóa ảnh LUMA không xóa bản đã xuất ra ngoài.</Text></View>
 <Text style={styles.heading}>GIỚI HẠN BẢN THỬ NGHIỆM</Text>
 <View style={styles.itemColumn}><Text style={styles.muted}>Pro Assist không điều khiển manual ISO, shutter speed hay RAW. Zoom hiển thị theo tỷ lệ điều khiển API, không xác nhận ống kính quang học. Preset được xử lý sau khi chụp, giới hạn cạnh dài 2.048 px.</Text></View>
 <Text style={styles.footer}>LUMA CAMERA · 0.1.0 · REACT NATIVE + EXPO</Text>
</ScrollView></SafeAreaView>}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:C.bg},scroll:{padding:18,paddingBottom:50},heading:{color:C.accent,fontSize:11,fontWeight:'800',letterSpacing:2,marginTop:22,marginBottom:12},item:{backgroundColor:C.surface,padding:16,borderRadius:12,flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},itemColumn:{backgroundColor:C.surface,padding:16,borderRadius:12,gap:10,marginBottom:8},title:{color:C.white,fontWeight:'700',fontSize:15},muted:{color:C.muted,fontSize:12,lineHeight:19},row:{flexDirection:'row',flexWrap:'wrap',gap:5},footer:{color:C.dim,textAlign:'center',fontSize:10,letterSpacing:1.4,marginTop:28}});
