import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C } from '../theme/colors';

export function ScreenHeader({ title, back, trailing }: { title: string; back?: () => void; trailing?: React.ReactNode }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={back} disabled={!back} style={styles.back}><Text style={styles.backText}>{back ? '‹' : '◉'}</Text></Pressable>
    <Text style={styles.title}>{title}</Text><View style={styles.trailing}>{trailing}</View>
  </View>;
}
export function Action({ title, onPress, secondary = false, disabled = false, style }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress}
    style={[styles.action, secondary && styles.actionSecondary, disabled && {opacity: 0.5}, style]}>
    <Text style={[styles.actionText, secondary && { color: C.white }]}>{title}</Text>
  </Pressable>;
}
export function Chip({ title, active, onPress }: {title: string; active: boolean; onPress: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && {color:C.bg}]}>{title}</Text>
  </Pressable>;
}
export function Panel({children}:{children:React.ReactNode}){return <View style={styles.panel}>{children}</View>;}
export function EmptyState({title,detail,action}:{title:string;detail?:string;action?:React.ReactNode}){
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text>{detail&&<Text style={styles.emptyDetail}>{detail}</Text>}{action}</View>;
}
export function SectionTitle({children}:{children:React.ReactNode}){return <Text style={styles.section}>{children}</Text>;}
export function BottomNav({active,navigate}:{active:string;navigate:(target:'camera'|'filters'|'library'|'memories'|'settings')=>void}){
  const tabs:[string,'camera'|'filters'|'library'|'memories'|'settings'][]=[
    ['Chụp','camera'],['Bộ lọc','filters'],['Thư viện','library'],['Kỷ niệm','memories'],['Cài đặt','settings']
  ];
  return <View style={styles.nav}>{tabs.map(([label,target])=><Pressable key={target} accessibilityRole="button"
    accessibilityState={{selected:active===target}} onPress={()=>navigate(target)} style={[styles.navItem,active===target&&styles.navActive]}>
    <Text style={[styles.navText,active===target&&styles.navTextActive]}>{label}</Text>
  </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  header:{height:60,flexDirection:'row',alignItems:'center',paddingHorizontal:16,backgroundColor:C.bg,borderBottomWidth:1,borderBottomColor:C.border},
  back:{width:44,justifyContent:'center',alignItems:'flex-start'}, backText:{color:C.accent,fontSize:30},
  title:{color:C.white,flex:1,fontSize:18,fontWeight:'700'}, trailing:{minWidth:44,alignItems:'flex-end'},
  action:{minHeight:48,paddingVertical:13,paddingHorizontal:18,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:C.accent},
  actionSecondary:{backgroundColor:C.elevated}, actionText:{fontSize:14,fontWeight:'700',color:C.bg},
  chip:{minHeight:44,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:10,borderRadius:30,marginRight:8,justifyContent:'center'},
  chipActive:{borderColor:C.accent,backgroundColor:C.accent},chipText:{color:C.white,fontWeight:'600',fontSize:12},
  panel:{backgroundColor:C.surface,borderRadius:14,borderWidth:1,borderColor:C.border,padding:16,gap:10},
  empty:{alignItems:'center',justifyContent:'center',padding:28,gap:12},
  emptyTitle:{color:C.white,fontWeight:'700',fontSize:18,textAlign:'center'},
  emptyDetail:{color:C.muted,fontSize:13,lineHeight:20,textAlign:'center'},
  section:{color:C.accent,fontSize:11,fontWeight:'800',letterSpacing:1.5,marginBottom:12,marginTop:16},
  nav:{flexDirection:'row',borderTopWidth:1,borderTopColor:C.border,backgroundColor:C.bg,paddingHorizontal:8,paddingTop:8,paddingBottom:4,gap:4},
  navItem:{flex:1,minHeight:44,borderRadius:10,justifyContent:'center',alignItems:'center'},navActive:{backgroundColor:C.elevated},
  navText:{color:C.muted,fontSize:10,fontWeight:'700',textAlign:'center'},navTextActive:{color:C.accent},
});
