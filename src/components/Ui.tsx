import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C } from '../theme/colors';

export function ScreenHeader({ title, back, trailing }: { title: string; back?: () => void; trailing?: React.ReactNode }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" onPress={back} disabled={!back} style={styles.back}><Text style={styles.backText}>{back ? '‹' : '◉'}</Text></Pressable>
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
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && {color:C.bg}]}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  header:{height:58,flexDirection:'row',alignItems:'center',paddingHorizontal:14,backgroundColor:C.bg},
  back:{width:44,justifyContent:'center',alignItems:'flex-start'}, backText:{color:C.accent,fontSize:30},
  title:{color:C.white,flex:1,fontSize:18,fontWeight:'700',letterSpacing:1.1}, trailing:{minWidth:44,alignItems:'flex-end'},
  action:{paddingVertical:13,paddingHorizontal:18,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:C.accent},
  actionSecondary:{backgroundColor:C.elevated}, actionText:{fontSize:14,fontWeight:'700',color:C.bg},
  chip:{borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:10,borderRadius:30,marginRight:8},
  chipActive:{borderColor:C.accent,backgroundColor:C.accent},chipText:{color:C.white,fontWeight:'600',fontSize:12},
});
