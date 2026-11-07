import React, { forwardRef } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { C } from '../theme/colors';

type Coordinate = { latitude: number; longitude: number };
export type Region = Coordinate & { latitudeDelta: number; longitudeDelta: number };
type MapProps = ViewProps & {
  initialRegion?: Region;
  onMapReady?: () => void;
  onRegionChangeComplete?: (region: Region) => void;
};

const WebMap = forwardRef<React.ComponentRef<typeof View>, MapProps>(({ initialRegion, style, ...props }, ref) => (
  <View ref={ref} style={[styles.map, style]} {...props}>
    <View style={styles.iconCircle}>
      <Text style={styles.icon}>📍</Text>
    </View>
    <Text style={styles.title}>Bản đồ tương tác khả dụng trên ứng dụng di động</Text>
    {initialRegion && (
      <View style={styles.coordsPill}>
        <Text style={styles.coords}>
          Tọa độ: {initialRegion.latitude.toFixed(5)}, {initialRegion.longitude.toFixed(5)}
        </Text>
      </View>
    )}
  </View>
));
WebMap.displayName = 'WebMap';

export function Marker(_props: { coordinate: Coordinate; title?: string; description?: string; onCalloutPress?: () => void }) {
  return null;
}
export default WebMap;

const styles = StyleSheet.create({
  map: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 179, 64, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.3)',
  },
  icon: { fontSize: 24 },
  title: { fontSize: 14, fontWeight: '800', color: C.white, textAlign: 'center' },
  coordsPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  coords: { fontSize: 12, color: C.muted, fontWeight: '600' },
});
