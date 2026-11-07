import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, type Region } from '../components/MapView';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useJourney } from './JourneyContext';
import { persistJourneyAssetCommitted } from './media';
import type { JourneyMemory, Trip } from './types';
import { GlassButton, GlassCard } from '../components/GlassUi';
import { C } from '../theme/colors';

const MODES = [
  'Bản đồ phủ sương',
  'Ngày ấy – bây giờ',
  'Người đồng hành',
  'Bưu thiếp tương lai',
  'Dấu vết vô hình',
] as const;

type Pin = JourneyMemory & { latitude: number; longitude: number };

function Atlas({ pins }: { pins: Pin[] }) {
  const [region, setRegion] = useState<Region>({ ...pins[0], latitudeDelta: 0.04, longitudeDelta: 0.04 });
  const cells = new Set(
    pins.map(p => {
      const x = Math.floor(9 * (((p.longitude - region.longitude) / region.longitudeDelta) + 0.5));
      const y = Math.floor(9 * (0.5 - ((p.latitude - region.latitude) / region.latitudeDelta)));
      return `${x},${y}`;
    })
  );

  return (
    <View style={styles.atlasContainer}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={setRegion}
      >
        {pins.map(p => (
          <Marker key={p.id} coordinate={p} title={p.title} />
        ))}
      </MapView>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: 9 }, (_, y) => (
          <View key={y} style={{ flex: 1, flexDirection: 'row' }}>
            {Array.from({ length: 9 }, (_, x) => (
              <View
                key={x}
                style={{
                  flex: 1,
                  backgroundColor: cells.has(`${x},${y}`) ? 'transparent' : 'rgba(8, 12, 20, 0.88)',
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

async function currentPoint() {
  if (!(await Location.requestForegroundPermissionsAsync()).granted)
    throw Error('Cần quyền vị trí để đặt hoặc đọc lời nhắn.');
  const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  if (coords.accuracy == null || coords.accuracy > 40)
    throw Error('GPS chưa đủ chính xác. Hãy thử lại ở nơi thoáng đãng.');
  return coords;
}

function distance(a: { latitude: number; longitude: number }, b: typeof a) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((a.latitude - b.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(((a.longitude - b.longitude) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export default function Discovery({ trip }: { trip: Trip }) {
  const { memories, updateTripExtras, updateMemory, createMemory } = useJourney();
  const rows = memories.filter(m => m.tripId === trip.id);
  const pins = rows.filter((m): m is Pin => m.latitude !== undefined && m.longitude !== undefined);
  const [mode, select] = useState<string>('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [photo, choose] = useState<JourneyMemory>();
  const [pair, setPair] = useState<{ before: string; after: string }>();
  const [showBefore, setShowBefore] = useState(false);
  const camera = useRef<CameraView>(null);
  const [permission, request] = useCameraPermissions();
  const lock = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    try {
      await fn();
    } catch (e) {
      Alert.alert('Không thể thực hiện', e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
    }
  };

  const people = [...new Set(memories.flatMap(m => m.tags || []).filter(t => t.startsWith('@')))];
  const tag = `@${name.trim().replace(/^@/, '')}`;

  async function capture() {
    if (!photo) return;
    const shot = await camera.current?.takePictureAsync();
    if (!shot) throw Error('Camera chưa sẵn sàng.');
    const saved = await persistJourneyAssetCommitted(shot.uri, 'bay-gio.jpg', stored =>
      createMemory({
        ...stored,
        tripId: trip.id,
        kind: 'photo',
        title: (`Bây giờ · ${photo.title}`).slice(0, 100),
        note: `Ảnh gốc: ${photo.createdAt}`,
      })
    );
    if (photo.uri && saved.uri) {
      setPair({ before: photo.uri, after: saved.uri });
      setShowBefore(false);
    }
    choose(undefined);
  }

  async function send(months: number) {
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('postcards', {
        name: 'Bưu thiếp',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    if (!(await Notifications.requestPermissionsAsync()).granted)
      throw Error('Cần quyền thông báo để nhận bưu thiếp.');
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    await Notifications.scheduleNotificationAsync({
      identifier: `postcard-${trip.id}`,
      content: {
        title: `Bưu thiếp từ ${trip.destination}`,
        body: `${trip.title} · ${rows.length} kỷ niệm`,
        data: { postcard: true, tripId: trip.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'postcards' },
    });
    Alert.alert('Đã lên lịch bưu thiếp', `Bạn sẽ nhận được bưu thiếp vào ngày ${date.toLocaleDateString('vi-VN')}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>Khám phá & Tiện ích hành trình</Text>

      {/* MODE SELECTOR TILES */}
      <View style={styles.modeGrid}>
        {MODES.map((item, index) => {
          const isSelected = mode === item;
          const icons = ['🗺️', '📸', '👥', '📬', '📍'];
          const subs = [
            'Mở sương mù từng nơi đã đến',
            'Chụp lại góc nhìn năm xưa',
            'Gắn thẻ bạn bè cùng đi',
            'Gửi bưu thiếp đến tương lai',
            'Để lại lời nhắn bí mật',
          ];

          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ expanded: isSelected }}
              style={({ pressed }) => [
                styles.modeCard,
                isSelected && styles.modeCardSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                select(isSelected ? '' : item);
                choose(undefined);
                setPair(undefined);
              }}
            >
              <Text style={styles.modeIcon}>{icons[index]}</Text>
              <Text style={[styles.modeTitle, isSelected && styles.modeTitleSelected]}>{item}</Text>
              <Text style={styles.modeSub}>{subs[index]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 1. BẢN ĐỒ PHỦ SƯƠNG */}
      {mode === MODES[0] && (
        <GlassCard style={styles.modePanel}>
          {pins.length ? (
            <Atlas pins={pins} />
          ) : (
            <Text style={styles.panelText}>
              Gắn tọa độ vị trí vào ít nhất một kỷ niệm để mở ô sương mù đầu tiên trên bản đồ.
            </Text>
          )}
        </GlassCard>
      )}

      {/* 2. NGÀY ẤY - BÂY GIỜ */}
      {mode === MODES[1] && (
        <GlassCard style={styles.modePanel}>
          {pair ? (
            <View style={{ gap: 12 }}>
              <Image source={{ uri: showBefore ? pair.before : pair.after }} style={styles.compareImage} />
              <GlassButton
                title={showBefore ? 'Xem ảnh bây giờ ➔' : '⮌ Xem ảnh ngày ấy'}
                variant="primary"
                onPress={() => setShowBefore(!showBefore)}
              />
            </View>
          ) : !photo ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.panelText}>Chọn một bức ảnh cũ để căn góc chụp lại ngay hôm nay:</Text>
              {rows
                .filter(m => m.kind === 'photo' && m.uri)
                .map(m => (
                  <GlassButton
                    key={m.id}
                    title={m.title}
                    variant="glass"
                    icon="📷"
                    onPress={() =>
                      void run(async () => {
                        if (permission?.granted || (await request()).granted) choose(m);
                        else throw Error('Cần quyền camera để chụp lại.');
                      })
                    }
                  />
                ))}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.cameraBox}>
                <CameraView ref={camera} style={StyleSheet.absoluteFill} />
                <Image
                  source={{ uri: photo.uri }}
                  resizeMode="cover"
                  style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: 0.42 }]}
                />
              </View>
              <GlassButton title="Chụp ảnh theo góc cũ" variant="primary" icon="📸" onPress={() => void run(capture)} />
            </View>
          )}
        </GlassCard>
      )}

      {/* 3. NGƯỜI ĐỒNG HÀNH */}
      {mode === MODES[2] && (
        <GlassCard style={styles.modePanel}>
          <Text style={styles.panelText}>Nhập tên bạn bè cùng tham gia hành trình:</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={C.dim}
            placeholder="Ví dụ: Hoàng, Linh..."
            maxLength={80}
            value={name}
            onChangeText={setName}
          />
          {people.length > 0 && (
            <View style={styles.chipRow}>
              {people.map(p => (
                <Pressable
                  key={p}
                  style={styles.companionChip}
                  onPress={() => setName(p.slice(1))}
                >
                  <Text style={styles.companionChipText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {tag.length > 1 && (
            <View style={{ gap: 8, marginTop: 6 }}>
              <Text style={styles.subHeading}>Gắn hoặc bỏ {tag} khỏi kỷ niệm:</Text>
              {rows.map(m => (
                <GlassButton
                  key={m.id}
                  title={(m.tags?.includes(tag) ? '✓ ' : '＋ ') + m.title}
                  variant={m.tags?.includes(tag) ? 'accent-glass' : 'glass'}
                  onPress={() =>
                    void run(async () => {
                      const tags = m.tags || [];
                      if (!tags.includes(tag) && tags.length >= 10) throw Error('Kỷ niệm đã đủ 10 nhãn.');
                      updateMemory(m.id, {
                        tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
                      });
                    })
                  }
                />
              ))}
              {memories.some(m => m.tags?.includes(tag) && m.latitude !== undefined) && (
                <Atlas
                  key={tag}
                  pins={memories.filter(
                    (m): m is Pin => !!m.tags?.includes(tag) && m.latitude !== undefined && m.longitude !== undefined
                  )}
                />
              )}
            </View>
          )}
        </GlassCard>
      )}

      {/* 4. BƯU THIẾP TƯƠNG LAI */}
      {mode === MODES[3] && (
        <GlassCard style={styles.modePanel}>
          <Text style={styles.panelText}>
            Lên lịch gửi một bưu thiếp hồi ức về chuyến đi {trip.destination} sau một khoảng thời gian:
          </Text>
          <View style={styles.scheduleRow}>
            {[3, 6, 12].map(n => (
              <GlassButton
                key={n}
                title={`Sau ${n} tháng`}
                variant="accent-glass"
                icon="📬"
                style={{ flex: 1 }}
                onPress={() => void run(() => send(n))}
              />
            ))}
          </View>
        </GlassCard>
      )}

      {/* 5. DẤU VẾT VÔ HÌNH */}
      {mode === MODES[4] && (
        <GlassCard style={styles.modePanel}>
          {trip.trace ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.panelText}>Một lời nhắn đã được cất giấu tại tọa độ GPS của bạn.</Text>
              <GlassButton
                title="Mở lời nhắn (khi trong phạm vi 100m)"
                variant="primary"
                icon="📍"
                onPress={() =>
                  void run(async () => {
                    const point = await currentPoint();
                    if (distance(point, trip.trace!) + (point.accuracy || 0) > 100)
                      throw Error('Bạn chưa ở đủ gần nơi cất giấu lời nhắn (dưới 100 m).');
                    Alert.alert('Lời nhắn tìm thấy tại đây', trip.trace!.message);
                  })
                }
              />
              <GlassButton
                title="Xóa lời nhắn ẩn"
                variant="danger"
                onPress={() =>
                  Alert.alert('Xóa lời nhắn?', '', [
                    { text: 'Giữ lại', style: 'cancel' },
                    { text: 'Xóa', style: 'destructive', onPress: () => updateTripExtras(trip.id, { trace: undefined }) },
                  ])
                }
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.panelText}>
                Gửi một lời nhắn cho chính bạn hoặc người thân khi quay trở lại vị trí này trong tương lai:
              </Text>
              <TextInput
                style={styles.textInput}
                placeholderTextColor={C.dim}
                placeholder="Viết lời nhắn bí mật tại đây..."
                value={message}
                maxLength={500}
                onChangeText={setMessage}
              />
              <GlassButton
                title="Khóa lời nhắn tại tọa độ này"
                variant="primary"
                icon="🔒"
                onPress={() =>
                  void run(async () => {
                    if (!message.trim()) throw Error('Hãy nhập nội dung lời nhắn trước.');
                    const { latitude, longitude } = await currentPoint();
                    updateTripExtras(trip.id, { trace: { latitude, longitude, message: message.trim() } });
                    setMessage('');
                    Alert.alert('Thành công', 'Lời nhắn đã được neo cố định tại tọa độ này.');
                  })
                }
              />
            </View>
          )}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionHeading: { color: C.white, fontSize: 17, fontWeight: '800' },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeCard: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glassCard,
    gap: 6,
  },
  modeCardSelected: {
    borderColor: C.accent,
    backgroundColor: 'rgba(255, 179, 64, 0.12)',
  },
  modeIcon: { fontSize: 24 },
  modeTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  modeTitleSelected: { color: C.accent },
  modeSub: { color: C.muted, fontSize: 11, lineHeight: 16 },
  modePanel: { padding: 18, gap: 12, marginTop: 4 },
  panelText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  subHeading: { color: C.white, fontSize: 13, fontWeight: '700' },
  atlasContainer: { height: 260, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder },
  compareImage: { height: 320, borderRadius: 16, backgroundColor: '#02070d' },
  cameraBox: { height: 320, borderRadius: 16, overflow: 'hidden' },
  textInput: {
    minHeight: 48,
    color: C.white,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  companionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  companionChipText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  scheduleRow: { flexDirection: 'row', gap: 10 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
