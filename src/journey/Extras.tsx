import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useJourney } from './JourneyContext';
import { persistJourneyAssetCommitted } from './media';
import { isValidLocalDate } from './validation';
import type { JourneyMemory } from './types';
import { DeviceSettings } from './Privacy';
import Discovery from './Discovery';
import { C } from '../theme/colors';

export function ExtraButton({
  title,
  onPress,
  variant = 'glass',
}: {
  title: string;
  onPress: () => void;
  variant?: 'glass' | 'accent' | 'danger';
}) {
  const isAccent = variant === 'accent';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        isAccent && styles.buttonAccent,
        isDanger && styles.buttonDanger,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.buttonText,
          isAccent && styles.buttonTextAccent,
          isDanger && styles.buttonTextDanger,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const showError = (error: unknown) =>
  Alert.alert('Không thể thực hiện', String(error instanceof Error ? error.message : error));

export function MemoryLabels({ memory }: { memory: JourneyMemory }) {
  const { updateMemory } = useJourney();
  const [tags, setTags] = useState((memory.tags || []).join(', '));

  return (
    <View style={styles.card}>
      <ExtraButton
        title={memory.favorite ? '★ Đã yêu thích' : '☆ Thêm vào yêu thích'}
        variant={memory.favorite ? 'accent' : 'glass'}
        onPress={() => {
          try {
            updateMemory(memory.id, { favorite: !memory.favorite });
          } catch (error) {
            showError(error);
          }
        }}
      />
      <Text style={styles.subLabel}>Nhãn phân loại (cách nhau bằng dấu phẩy)</Text>
      <TextInput
        accessibilityLabel="Nhãn kỷ niệm"
        style={styles.input}
        value={tags}
        onChangeText={setTags}
        maxLength={250}
        placeholder="Ẩm thực, Cà phê, View đẹp..."
        placeholderTextColor={C.dim}
      />
      <ExtraButton
        title="Lưu nhãn"
        onPress={() => {
          try {
            updateMemory(memory.id, {
              tags: [...new Set(tags.split(',').map(tag => tag.trim()).filter(Boolean))].slice(0, 10),
            });
          } catch (error) {
            showError(error);
          }
        }}
      />
    </View>
  );
}

export function TripExtras() {
  const router = useRouter();
  const { activeTrip, updateTripExtras, createMemory } = useJourney();
  const [date, setDate] = useState(activeTrip?.startDate || '');
  const [time, setTime] = useState('09:00');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!activeTrip) return null;
  const trip = activeTrip;
  const itinerary = trip.itinerary || [];

  const cover = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled) return;
      const memory = await persistJourneyAssetCommitted(
        result.assets[0].uri,
        result.assets[0].fileName || 'cover.jpg',
        stored => createMemory({ tripId: trip.id, kind: 'photo', title: 'Ảnh bìa chuyến đi', note: '', ...stored })
      );
      updateTripExtras(trip.id, { coverUri: memory.uri });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    try {
      if (!isValidLocalDate(date) || date < trip.startDate || date > trip.endDate)
        throw new Error('Chọn ngày trong khoảng chuyến đi, định dạng YYYY-MM-DD.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !place.trim())
        throw new Error('Nhập địa điểm và giờ hợp lệ HH:mm.');
      updateTripExtras(trip.id, {
        itinerary: [
          ...itinerary,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            date,
            time,
            place: place.trim(),
            visited: false,
          },
        ],
      });
      setPlace('');
      setEditing(false);
    } catch (error) {
      showError(error);
    }
  };

  return (
    <View style={styles.card}>
      <Discovery key={trip.id} trip={trip} />
      <View style={styles.divider} />

      <View style={styles.itineraryHeader}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={styles.title}>Lịch trình từng ngày</Text>
          <Text style={styles.subtext}>
            {itinerary.length ? `${itinerary.length} điểm đến trong hành trình` : 'Lên kế hoạch cho các điểm dừng chân.'}
          </Text>
        </View>
        <ExtraButton
          title={editing ? 'Đóng biểu mẫu' : '＋ Thêm điểm đến'}
          variant={editing ? 'glass' : 'accent'}
          onPress={() => setEditing(!editing)}
        />
      </View>

      {editing && (
        <View style={styles.itineraryForm}>
          <TextInput
            accessibilityLabel="Ngày lịch trình"
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.dim}
          />
          <TextInput
            accessibilityLabel="Giờ lịch trình"
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="HH:mm"
            placeholderTextColor={C.dim}
          />
          <TextInput
            accessibilityLabel="Địa điểm lịch trình"
            style={styles.input}
            value={place}
            onChangeText={setPlace}
            maxLength={100}
            placeholder="Tên địa điểm hoặc quán xá..."
            placeholderTextColor={C.dim}
          />
          <ExtraButton title="Thêm điểm đến vào lịch" variant="accent" onPress={add} />
        </View>
      )}

      {[...itinerary]
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map(item => (
          <View key={item.id} style={styles.stopCard}>
            <View style={styles.stopMeta}>
              <Text style={styles.stopDot}>{item.visited ? '✓' : '📍'}</Text>
              <Text style={[styles.stopText, item.visited && styles.stopTextVisited]}>
                {item.date} · {item.time} · {item.place}
              </Text>
            </View>
            <View style={styles.stopActionRow}>
              <ExtraButton
                title={item.visited ? 'Đã ghé qua' : 'Đánh dấu đã ghé'}
                variant={item.visited ? 'accent' : 'glass'}
                onPress={() => {
                  try {
                    updateTripExtras(trip.id, {
                      itinerary: itinerary.map(row => (row.id === item.id ? { ...row, visited: !row.visited } : row)),
                    });
                  } catch (error) {
                    showError(error);
                  }
                }}
              />
              <ExtraButton
                title="Ghi kỷ niệm"
                onPress={() => {
                  try {
                    const memory = createMemory({
                      tripId: trip.id,
                      kind: 'note',
                      title: item.place,
                      note: `Lịch trình ${item.date} ${item.time}`,
                    });
                    router.push({ pathname: '/journey/[scene]', params: { scene: 'edit-memory', id: memory.id } });
                  } catch (error) {
                    showError(error);
                  }
                }}
              />
              <ExtraButton
                title="Bỏ điểm"
                variant="danger"
                onPress={() => {
                  try {
                    updateTripExtras(trip.id, {
                      itinerary: itinerary.filter(row => row.id !== item.id),
                    });
                  } catch (error) {
                    showError(error);
                  }
                }}
              />
            </View>
          </View>
        ))}

      <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
        <ExtraButton
          title={busy ? 'Đang chọn ảnh…' : '🖼️ Thay ảnh bìa chuyến đi'}
          variant="glass"
          onPress={() => void cover()}
        />
      </View>
    </View>
  );
}

export function TrashAndDeviceSettings() {
  const { trash, restoreMemory, purgeMemory, storageError } = useJourney();
  return (
    <View style={styles.card}>
      <DeviceSettings />
      <View style={styles.itineraryHeader}>
        <Text style={styles.title}>Thùng rác ({trash.length})</Text>
      </View>
      <Text style={styles.subtext}>Ảnh và tệp được bảo lưu đến khi bạn xóa vĩnh viễn.</Text>
      {trash.map(memory => (
        <View key={memory.id} style={styles.stopCard}>
          <Text style={styles.stopText}>{memory.title}</Text>
          <View style={styles.stopActionRow}>
            <ExtraButton
              title="Khôi phục"
              variant="accent"
              onPress={() => {
                try {
                  restoreMemory(memory.id);
                } catch (error) {
                  showError(error);
                }
              }}
            />
            <ExtraButton
              title="Xóa vĩnh viễn"
              variant="danger"
              onPress={() =>
                Alert.alert('Xóa vĩnh viễn?', memory.title, [
                  { text: 'Hủy', style: 'cancel' },
                  {
                    text: 'Xóa',
                    style: 'destructive',
                    onPress: () => {
                      try {
                        if (storageError) throw new Error(storageError);
                        purgeMemory(memory.id);
                      } catch (error) {
                        showError(error);
                      }
                    },
                  },
                ])
              }
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 20,
    borderRadius: 22,
    backgroundColor: C.glassCard,
    borderColor: C.glassBorder,
    borderWidth: 1,
  },
  title: { color: C.white, fontSize: 17, fontWeight: '800' },
  subtext: { color: C.muted, fontSize: 13, lineHeight: 18 },
  subLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.glassBorder, marginVertical: 8 },

  input: {
    minHeight: 48,
    color: C.white,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    fontSize: 14,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  buttonAccent: {
    backgroundColor: 'rgba(255, 179, 64, 0.16)',
    borderColor: 'rgba(255, 179, 64, 0.4)',
  },
  buttonDanger: {
    backgroundColor: C.dangerGlass,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  buttonText: { color: C.text, fontSize: 13, fontWeight: '700' },
  buttonTextAccent: { color: C.accent },
  buttonTextDanger: { color: C.danger },

  itineraryHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itineraryForm: { gap: 10, paddingVertical: 8 },
  stopCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    gap: 10,
  },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopDot: { fontSize: 14, color: C.accent },
  stopText: { color: C.white, fontSize: 14, fontWeight: '700', flex: 1 },
  stopTextVisited: { color: C.muted, textDecorationLine: 'line-through' },
  stopActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
