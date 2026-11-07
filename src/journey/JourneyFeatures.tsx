import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import MapView, { Marker } from '../components/MapView';
import PagerView from '../components/PagerView';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import { useJourney } from './JourneyContext';
import {
  inspectJourneyStorage,
  persistJourneyAssetCommitted,
  removeJourneyAsset,
  type JourneyStorageReport,
} from './media';
import { createTripBackup, readTripBackup } from './backup';
import { usePrefs } from '../state/Prefs';
import { MemoryLabels, TrashAndDeviceSettings } from './Extras';
import { useDiaryLocked } from './Privacy';
import { localDateString, parseCoordinates } from './validation';
import type { JourneyMemory, TripDraft } from './types';
import type { JourneyScene } from './scenes';
import { GlassButton, GlassCard, GlassInput, GlassPill, ImageViewerModal } from '../components/GlassUi';
import { C, GRADIENTS } from '../theme/colors';

function Notice({
  symbol = '✦',
  title,
  detail,
}: {
  symbol?: string;
  title: string;
  detail: string;
}) {
  return (
    <GlassCard style={s.notice}>
      <View style={s.noticeSymbolWrap}>
        <Text style={s.noticeSymbol}>{symbol}</Text>
      </View>
      <Text style={s.noticeTitle}>{title}</Text>
      <Text style={s.noticeDetail}>{detail}</Text>
    </GlassCard>
  );
}

function fmt(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function kindLabel(kind: JourneyMemory['kind']) {
  return {
    photo: 'Ảnh',
    video: 'Video',
    audio: 'Ghi âm',
    note: 'Ghi chú',
    document: 'Tài liệu',
  }[kind];
}

function kindIcon(kind: JourneyMemory['kind']) {
  return {
    photo: '🖼️',
    video: '🎥',
    audio: '🎙️',
    note: '📝',
    document: '📄',
  }[kind];
}

export function AudioCard({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const locked = useDiaryLocked();

  useEffect(() => {
    if (locked) player.pause();
  }, [locked, player]);

  useFocusEffect(
    useCallback(() => () => {
      try {
        player.pause();
      } catch {
        /* Player may already be released on unmount. */
      }
    }, [player])
  );

  return (
    <GlassCard style={s.player}>
      <View style={s.playerIconWrap}>
        <Text style={s.playerIcon}>🎙️</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.playerTitle}>Bản ghi âm hành trình</Text>
        <Text style={s.playerTime}>
          {Math.round(status.currentTime || 0)}s / {Math.round(status.duration || 0)}s
        </Text>
      </View>
      <GlassButton
        title={status.playing ? 'Tạm dừng' : 'Phát'}
        variant={status.playing ? 'glass' : 'primary'}
        onPress={() => (status.playing ? player.pause() : player.play())}
      />
    </GlassCard>
  );
}

function VideoCard({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  const locked = useDiaryLocked();

  useEffect(() => {
    if (locked) player.pause();
  }, [locked, player]);

  useFocusEffect(
    useCallback(() => () => {
      try {
        player.pause();
      } catch {
        /* Player may already be released on unmount. */
      }
    }, [player])
  );

  return <VideoView player={player} style={s.media} nativeControls contentFit="contain" />;
}

function Media({ memory }: { memory: JourneyMemory }) {
  const [lightbox, setLightbox] = useState(false);
  if (!memory.uri) return <Notice symbol="📝" title={memory.title} detail={memory.note || 'Kỷ niệm dạng ghi chú.'} />;
  if (memory.kind === 'photo') {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem ảnh toàn màn hình"
          onPress={() => setLightbox(true)}
        >
          <Image source={{ uri: memory.uri }} style={s.media} resizeMode="cover" />
          <View style={s.zoomHint}>
            <Text style={s.zoomHintText}>🔍 Chạm xem ảnh lớn</Text>
          </View>
        </Pressable>
        <ImageViewerModal
          uri={lightbox ? memory.uri : null}
          title={memory.title}
          date={fmt(memory.createdAt)}
          onClose={() => setLightbox(false)}
        />
      </View>
    );
  }
  if (memory.kind === 'video') return <VideoCard uri={memory.uri} />;
  if (memory.kind === 'audio') return <AudioCard uri={memory.uri} />;
  return (
    <Notice
      symbol="📄"
      title={memory.fileName || memory.title}
      detail="Tài liệu đã được sao chép vào vùng lưu trữ an toàn của ứng dụng."
    />
  );
}

function EditTrip() {
  const router = useRouter();
  const { activeTrip, updateTrip, deleteTrip } = useJourney();
  const [form, setForm] = useState<TripDraft>(() =>
    activeTrip
      ? {
          title: activeTrip.title,
          destination: activeTrip.destination,
          description: activeTrip.description,
          startDate: activeTrip.startDate,
          endDate: activeTrip.endDate,
        }
      : {
          title: '',
          destination: '',
          description: '',
          startDate: localDateString(),
          endDate: localDateString(),
        }
  );
  const [error, setError] = useState('');
  if (!activeTrip) return <Notice symbol="⚠️" title="Không có chuyến đi" detail="Hãy tạo hoặc chọn một chuyến đi trước." />;

  return (
    <GlassCard style={s.stack}>
      <GlassInput
        label="Tên chuyến đi"
        value={form.title}
        onChangeText={val => setForm(v => ({ ...v, title: val }))}
      />
      <GlassInput
        label="Điểm đến"
        value={form.destination}
        onChangeText={val => setForm(v => ({ ...v, destination: val }))}
      />
      <GlassInput
        label="Mô tả"
        multiline
        value={form.description}
        onChangeText={val => setForm(v => ({ ...v, description: val }))}
      />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <GlassInput
            label="Bắt đầu"
            value={form.startDate}
            onChangeText={val => setForm(v => ({ ...v, startDate: val }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GlassInput
            label="Kết thúc"
            value={form.endDate}
            onChangeText={val => setForm(v => ({ ...v, endDate: val }))}
          />
        </View>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      <GlassButton
        title="Lưu thay đổi"
        variant="primary"
        onPress={() => {
          try {
            updateTrip(activeTrip.id, form);
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      <GlassButton
        title="Xóa chuyến đi"
        variant="danger"
        onPress={() =>
          Alert.alert(
            'Xóa chuyến đi?',
            'Xóa vĩnh viễn chuyến đi và toàn bộ kỷ niệm, kể cả thùng rác. Hãy sao lưu trước.',
            [
              { text: 'Hủy', style: 'cancel' },
              {
                text: 'Xóa',
                style: 'destructive',
                onPress: () => {
                  try {
                    deleteTrip(activeTrip.id);
                    router.replace('/');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                },
              },
            ]
          )
        }
      />
    </GlassCard>
  );
}

function MediaPickerScreen() {
  const [error, setError] = useState('');
  const router = useRouter();
  const { activeTrip, createMemory } = useJourney();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    if (!activeTrip) return;
    setBusy(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Cần quyền thư viện ảnh để chọn nội dung.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const kind = asset.type === 'video' ? 'video' : 'photo';
      const memory = await persistJourneyAssetCommitted(asset.uri, asset.fileName || undefined, stored =>
        createMemory({
          tripId: activeTrip.id,
          kind,
          title: kind === 'video' ? 'Video hành trình' : 'Ảnh hành trình',
          note: '',
          uri: stored.uri,
          fileName: stored.fileName,
          mimeType: asset.mimeType || undefined,
          durationMs: asset.duration || undefined,
        })
      );
      router.replace({ pathname: '/journey/[scene]', params: { scene: 'capture-review', id: memory.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.stack}>
      <Notice
        symbol="🖼️"
        title="Ảnh và video trên máy"
        detail="Ảnh và video được bảo quản an toàn cùng chuyến đi. Trên web, mỗi file tối đa 50 MB."
      />
      <GlassButton
        title={busy ? 'Đang nhập…' : 'Chọn ảnh hoặc video'}
        variant="primary"
        icon="📥"
        disabled={busy || !activeTrip}
        onPress={() => void pick()}
      />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </View>
  );
}

function DocumentScreen() {
  const router = useRouter();
  const { activeTrip, createMemory } = useJourney();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    if (!activeTrip) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const memory = await persistJourneyAssetCommitted(asset.uri, asset.name, stored =>
        createMemory({
          tripId: activeTrip.id,
          kind: 'document',
          title: asset.name,
          note: '',
          uri: stored.uri,
          fileName: stored.fileName,
          mimeType: asset.mimeType || undefined,
        })
      );
      router.replace({ pathname: '/journey/[scene]', params: { scene: 'memory-detail', id: memory.id } });
    } catch (e) {
      Alert.alert('Không thể đính kèm', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.stack}>
      <Notice
        symbol="📄"
        title="Vé và tài liệu chuyến đi"
        detail="Lưu vé máy bay, đặt phòng khách sạn hoặc lịch trình chuyến đi dạng PDF vào hành trình."
      />
      <GlassButton
        title={busy ? 'Đang sao chép…' : 'Chọn tệp tài liệu'}
        variant="primary"
        icon="📎"
        disabled={busy || !activeTrip}
        onPress={() => void pick()}
      />
    </View>
  );
}

function RecorderScreen() {
  const router = useRouter();
  const { activeTrip, createMemory } = useJourney();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Cần quyền micro để ghi âm.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert('Không thể ghi âm', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!activeTrip) return;
    setBusy(true);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('Không nhận được file ghi âm.');
      const memory = await persistJourneyAssetCommitted(recorder.uri, 'ghi-am.m4a', stored =>
        createMemory({
          tripId: activeTrip.id,
          kind: 'audio',
          title: 'Ghi âm hành trình',
          note: '',
          uri: stored.uri,
          fileName: stored.fileName,
          mimeType: 'audio/mp4',
          durationMs: state.durationMillis,
        })
      );
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      router.replace({ pathname: '/journey/[scene]', params: { scene: 'audio-review', id: memory.id } });
    } catch (e) {
      Alert.alert('Không thể lưu ghi âm', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => () => {
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  }, []);

  return (
    <GlassCard style={s.recorder}>
      <View style={[s.recordOrb, state.isRecording && s.recording]}>
        <Text style={s.recordIcon}>{state.isRecording ? '■' : '🎙️'}</Text>
      </View>
      <Text style={s.time}>
        {Math.floor(state.durationMillis / 60000)
          .toString()
          .padStart(2, '0')}
        :
        {Math.floor((state.durationMillis / 1000) % 60)
          .toString()
          .padStart(2, '0')}
      </Text>
      <Text style={s.body}>
        {state.isRecording
          ? 'Đang thu lại âm thanh xung quanh hành trình…'
          : 'Sẵn sàng ghi lại giọng nói và âm thanh chuyến đi.'}
      </Text>
      <GlassButton
        title={state.isRecording ? 'Dừng và lưu' : busy ? 'Đang chuẩn bị…' : 'Bắt đầu ghi âm'}
        variant={state.isRecording ? 'danger' : 'primary'}
        disabled={busy || !activeTrip}
        onPress={() => void (state.isRecording ? stop() : start())}
      />
    </GlassCard>
  );
}

function EditMemory({ memory }: { memory?: JourneyMemory }) {
  const router = useRouter();
  const { activeTrip, createMemory, updateMemory } = useJourney();
  const [title, setTitle] = useState(memory?.title || '');
  const [note, setNote] = useState(memory?.note || '');
  const [lat, setLat] = useState(memory?.latitude?.toString() || '');
  const [lng, setLng] = useState(memory?.longitude?.toString() || '');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    setError('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Cần quyền vị trí để gắn tọa độ hiện tại.');
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Không lấy được vị trí sau 15 giây. Hãy kiểm tra GPS và thử lại.')),
            15000
          );
        }),
      ]);
      setLat(position.coords.latitude.toFixed(6));
      setLng(position.coords.longitude.toFixed(6));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (timeout) clearTimeout(timeout);
      setLocating(false);
    }
  };

  const save = () => {
    try {
      const { latitude, longitude } = parseCoordinates(lat, lng);
      let id = memory?.id;
      if (id) {
        updateMemory(id, { ...memory, title, note, latitude, longitude });
      } else {
        if (!activeTrip) throw new Error('Chưa chọn chuyến đi.');
        id = createMemory({ tripId: activeTrip.id, kind: 'note', title, note, latitude, longitude }).id;
      }
      router.replace({ pathname: '/journey/[scene]', params: { scene: 'memory-detail', id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <GlassCard style={s.stack}>
      <GlassInput
        label="Tiêu đề"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        placeholder="Khoảnh khắc đáng nhớ..."
      />
      <GlassInput
        label="Ghi chú & Cảm xúc"
        multiline
        value={note}
        onChangeText={setNote}
        maxLength={1000}
        placeholder="Chia sẻ cảm xúc của bạn tại đây..."
      />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <GlassInput
            label="Vĩ độ"
            keyboardType="numbers-and-punctuation"
            value={lat}
            onChangeText={setLat}
            placeholder="16.0471"
          />
        </View>
        <View style={{ flex: 1 }}>
          <GlassInput
            label="Kinh độ"
            keyboardType="numbers-and-punctuation"
            value={lng}
            onChangeText={setLng}
            placeholder="108.2068"
          />
        </View>
      </View>
      <GlassButton
        title={locating ? 'Đang lấy vị trí GPS…' : 'Lấy vị trí hiện tại'}
        variant="accent-glass"
        icon="📍"
        disabled={locating}
        onPress={() => void useCurrentLocation()}
      />
      {!!error && <Text style={s.error}>{error}</Text>}
      <GlassButton
        title="Lưu kỷ niệm"
        variant="primary"
        disabled={locating}
        onPress={save}
      />
    </GlassCard>
  );
}

function MemoryDetail({ memory, review = false }: { memory?: JourneyMemory; review?: boolean }) {
  const router = useRouter();
  const { deleteMemory, restoreMemory } = useJourney();
  if (!memory) return <Notice symbol="❓" title="Không tìm thấy kỷ niệm" detail="Nội dung có thể đã bị xóa." />;

  return (
    <View style={s.stack}>
      <Media memory={memory} />
      <MemoryLabels key={memory.id} memory={memory} />

      <GlassCard style={s.detailCard}>
        <View style={s.metaRow}>
          <View style={s.tagPill}>
            <Text style={s.tagIcon}>{kindIcon(memory.kind)}</Text>
            <Text style={s.tag}>{kindLabel(memory.kind).toUpperCase()}</Text>
          </View>
          <Text style={s.body}>{fmt(memory.createdAt)}</Text>
        </View>
        <Text style={s.heading}>{memory.title}</Text>
        {!!memory.note && <Text style={s.detailNote}>{memory.note}</Text>}

        {memory.latitude !== undefined && memory.longitude !== undefined && (
          <View style={s.miniMapWrap}>
            <MapView
              style={s.miniMap}
              initialRegion={{
                latitude: memory.latitude,
                longitude: memory.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker coordinate={{ latitude: memory.latitude, longitude: memory.longitude }} />
            </MapView>
          </View>
        )}
      </GlassCard>

      {memory.kind === 'document' && memory.uri && (
        <GlassButton
          title="Mở bảng chia sẻ tài liệu"
          variant="glass"
          icon="📤"
          onPress={() =>
            void Sharing.shareAsync(memory.uri!, {
              mimeType: memory.mimeType,
              dialogTitle: memory.fileName || memory.title,
            }).catch(e => Alert.alert('Không thể mở tài liệu', String(e)))
          }
        />
      )}

      <GlassButton
        title={review ? 'Thêm thông tin' : 'Chỉnh sửa'}
        variant="primary"
        icon="✏️"
        onPress={() =>
          router.push({
            pathname: '/journey/[scene]',
            params: { scene: 'edit-memory', id: memory.id },
          })
        }
      />
      <GlassButton
        title="Xóa kỷ niệm"
        variant="danger"
        icon="🗑️"
        onPress={() =>
          Alert.alert(
            'Xóa kỷ niệm?',
            'Kỷ niệm sẽ được chuyển vào thùng rác. Khôi phục trong Cài đặt.',
            [
              { text: 'Hủy', style: 'cancel' },
              {
                text: 'Xóa',
                style: 'destructive',
                onPress: () => {
                  try {
                    deleteMemory(memory.id);
                    Alert.alert('Đã chuyển vào thùng rác', memory.title, [
                      { text: 'Đóng' },
                      {
                        text: 'Hoàn tác',
                        onPress: () => {
                          try {
                            restoreMemory(memory.id);
                          } catch (e) {
                            Alert.alert('Không thể khôi phục', String(e));
                          }
                        },
                      },
                    ]);
                    router.replace({ pathname: '/journey/[scene]', params: { scene: 'timeline' } });
                  } catch (e) {
                    Alert.alert('Không thể xóa', String(e));
                  }
                },
              },
            ]
          )
        }
      />
    </View>
  );
}

function TripMap() {
  const router = useRouter();
  const { activeTrip, memories } = useJourney();
  const map = useRef<MapView>(null);
  const located = memories.filter(
    m => m.tripId === activeTrip?.id && m.latitude !== undefined && m.longitude !== undefined
  );
  const coordinates = located.map(m => ({ latitude: m.latitude!, longitude: m.longitude! }));
  const coordinateKey = coordinates.map(point => `${point.latitude},${point.longitude}`).join('|');

  const fit = () => {
    if (coordinates.length === 1) {
      map.current?.animateToRegion?.({ ...coordinates[0], latitudeDelta: 0.05, longitudeDelta: 0.05 }, 300);
    } else if (coordinates.length > 1) {
      map.current?.fitToCoordinates?.(coordinates, {
        edgePadding: { top: 70, right: 45, bottom: 120, left: 45 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(fit, 250);
    return () => clearTimeout(timer);
  }, [coordinateKey]);

  const initial = coordinates[0] || { latitude: 16.0471, longitude: 108.2068 };

  return (
    <View style={s.mapWrap}>
      <MapView
        ref={map}
        style={s.map}
        initialRegion={{
          ...initial,
          latitudeDelta: coordinates.length ? 0.2 : 12,
          longitudeDelta: coordinates.length ? 0.2 : 12,
        }}
        onMapReady={fit}
      >
        {located.map(m => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude!, longitude: m.longitude! }}
            title={m.title}
            description={m.note}
            onCalloutPress={() =>
              router.push({ pathname: '/journey/[scene]', params: { scene: 'place-detail', id: m.id } })
            }
          />
        ))}
      </MapView>

      {coordinates.length > 0 && (
        <Pressable accessibilityRole="button" style={s.mapFit} onPress={fit}>
          <Text style={s.mapFitText}>📍 Căn theo địa điểm</Text>
        </Pressable>
      )}

      {!located.length && (
        <View style={s.mapEmpty}>
          <Text style={s.mapEmptyText}>
            Chưa có kỷ niệm nào được gắn tọa độ. Bạn có thể thêm vị trí trong màn Chỉnh sửa kỷ niệm.
          </Text>
        </View>
      )}
    </View>
  );
}

function Timeline() {
  const router = useRouter();
  const { activeTrip, memories } = useJourney();
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [kind, setKind] = useState<'all' | JourneyMemory['kind']>('all');
  const [limit, setLimit] = useState(30);

  const all = memories
    .filter(m => m.tripId === activeTrip?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useEffect(() => setLimit(30), [query, kind, favorites, activeTrip?.id]);

  if (!all.length) {
    return (
      <Notice
        symbol="⏱️"
        title="Timeline còn trống"
        detail="Chụp ảnh, quay video hoặc viết ghi chú đầu tiên cho hành trình này."
      />
    );
  }

  const needle = query.trim().toLocaleLowerCase('vi-VN');
  const items = all.filter(
    m =>
      (!favorites || m.favorite) &&
      (kind === 'all' || m.kind === kind) &&
      (!needle ||
        `${m.title} ${m.note} ${(m.tags || []).join(' ')} ${m.fileName || ''}`
          .toLocaleLowerCase('vi-VN')
          .includes(needle))
  );
  const visible = items.slice(0, limit);

  return (
    <View style={s.stack}>
      {/* FILTER CONTROLS */}
      <View style={s.filterHeader}>
        <GlassPill
          title="Yêu thích"
          icon="★"
          active={favorites}
          onPress={() => setFavorites(value => !value)}
        />
        <View style={{ flex: 1 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={s.search}
            placeholder="🔍 Tìm tiêu đề, ghi chú hoặc tệp..."
            placeholderTextColor={C.dim}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        <GlassPill title="Tất cả" active={kind === 'all'} onPress={() => setKind('all')} />
        {(['photo', 'video', 'audio', 'note', 'document'] as const).map(value => (
          <GlassPill
            key={value}
            title={kindLabel(value)}
            icon={kindIcon(value)}
            active={kind === value}
            onPress={() => setKind(value)}
          />
        ))}
      </ScrollView>

      {/* TIMELINE LIST */}
      {visible.length ? (
        visible.map((m, i) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            style={({ pressed }) => [s.timeline, pressed && s.pressed]}
            onPress={() =>
              router.push({
                pathname: '/journey/[scene]',
                params: { scene: 'memory-detail', id: m.id },
              })
            }
          >
            <View style={s.timelineRail}>
              <View style={s.dot} />
              {i < visible.length - 1 && <View style={s.line} />}
            </View>

            <GlassCard style={s.timelineCard}>
              <View style={s.timelineMeta}>
                <View style={s.tagPill}>
                  <Text style={s.tagIcon}>{kindIcon(m.kind)}</Text>
                  <Text style={s.tag}>{kindLabel(m.kind).toUpperCase()}</Text>
                </View>
                <Text style={s.timelineTime}>{fmt(m.createdAt)}</Text>
                {m.favorite && <Text style={s.starIcon}>★</Text>}
              </View>

              <Text style={s.timelineTitle}>{m.title}</Text>

              {m.kind === 'photo' && m.uri && (
                <Image
                  accessibilityLabel={m.title}
                  source={{ uri: m.uri }}
                  resizeMode="cover"
                  style={s.timelineMedia}
                />
              )}

              <Text numberOfLines={2} style={s.body}>
                {m.note || m.fileName || 'Không có ghi chú'}
              </Text>
            </GlassCard>
          </Pressable>
        ))
      ) : (
        <Notice symbol="🔍" title="Không tìm thấy kết quả" detail="Thử đổi từ khóa hoặc bộ lọc thể loại." />
      )}

      {visible.length < items.length && (
        <GlassButton
          title={`Xem thêm ${Math.min(30, items.length - visible.length)} mục`}
          variant="glass"
          onPress={() => setLimit(value => value + 30)}
        />
      )}
    </View>
  );
}

function Gallery() {
  const router = useRouter();
  const { activeTrip, memories } = useJourney();
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [kind, setKind] = useState<'all' | 'photo' | 'video'>('all');
  const [limit, setLimit] = useState(40);

  const all = memories.filter(
    m => m.tripId === activeTrip?.id && (m.kind === 'photo' || m.kind === 'video')
  );

  useEffect(() => setLimit(40), [query, kind, favorites, activeTrip?.id]);

  if (!all.length) {
    return (
      <Notice
        symbol="🖼️"
        title="Thư viện còn trống"
        detail="Chụp hoặc nhập ảnh và video để tạo bộ sưu tập khoảnh khắc."
      />
    );
  }

  const needle = query.trim().toLocaleLowerCase('vi-VN');
  const items = all.filter(
    m =>
      (!favorites || m.favorite) &&
      (kind === 'all' || m.kind === kind) &&
      (!needle ||
        `${m.title} ${m.note} ${(m.tags || []).join(' ')}`
          .toLocaleLowerCase('vi-VN')
          .includes(needle))
  );
  const visible = items.slice(0, limit);

  return (
    <View style={s.stack}>
      <View style={s.filterHeader}>
        <GlassPill
          title="Yêu thích"
          icon="★"
          active={favorites}
          onPress={() => setFavorites(value => !value)}
        />
        <View style={{ flex: 1 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={s.search}
            placeholder="🔍 Tìm ảnh hoặc video..."
            placeholderTextColor={C.dim}
          />
        </View>
      </View>

      <View style={s.filterRow}>
        <GlassPill title="Tất cả" active={kind === 'all'} onPress={() => setKind('all')} />
        <GlassPill title="Ảnh" icon="🖼️" active={kind === 'photo'} onPress={() => setKind('photo')} />
        <GlassPill title="Video" icon="🎥" active={kind === 'video'} onPress={() => setKind('video')} />
      </View>

      {visible.length ? (
        <View style={s.grid}>
          {visible.map(m => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              style={({ pressed }) => [s.gridItem, pressed && s.pressed]}
              onPress={() =>
                router.push({
                  pathname: '/journey/[scene]',
                  params: { scene: 'memory-detail', id: m.id },
                })
              }
            >
              {m.kind === 'photo' && m.uri ? (
                <Image source={{ uri: m.uri }} style={s.thumb} />
              ) : (
                <LinearGradient colors={GRADIENTS.hero} style={s.thumb}>
                  <Text style={s.videoIcon}>▶</Text>
                </LinearGradient>
              )}
              {m.kind === 'video' && (
                <View style={s.gridVideoBadge}>
                  <Text style={s.gridVideoBadgeText}>▶ Video</Text>
                </View>
              )}
              <Text numberOfLines={1} style={s.gridTitle}>
                {m.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Notice symbol="🔍" title="Không tìm thấy kết quả" detail="Thử đổi từ khóa tìm kiếm hoặc chọn lọc khác." />
      )}

      {visible.length < items.length && (
        <GlassButton
          title={`Xem thêm ${Math.min(40, items.length - visible.length)} mục`}
          variant="glass"
          onPress={() => setLimit(value => value + 40)}
        />
      )}
    </View>
  );
}

function Story() {
  const { activeTrip, memories } = useJourney();
  const [page, setPage] = useState(0);
  const items = memories.filter(m => m.tripId === activeTrip?.id);

  if (!items.length) {
    return <Notice symbol="✨" title="Chưa có câu chuyện" detail="Kỷ niệm của chuyến đi sẽ xuất hiện tại đây dưới dạng story." />;
  }

  return (
    <PagerView
      style={s.pager}
      initialPage={0}
      offscreenPageLimit={1}
      onPageSelected={event => setPage(event.nativeEvent.position)}
    >
      {items.map((m, i) => (
        <View key={m.id} style={s.story}>
          {i === page ? (
            <Media memory={m} />
          ) : (
            <View style={s.storyPlaceholder}>
              <Text style={s.videoIcon}>✦</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(7, 10, 17, 0.85)', C.bg]}
            style={s.storyCaption}
          >
            <View style={s.tagPill}>
              <Text style={s.tagIcon}>{kindIcon(m.kind)}</Text>
              <Text style={s.tag}>
                {i + 1} / {items.length} · {kindLabel(m.kind).toUpperCase()}
              </Text>
            </View>
            <Text style={s.heading}>{m.title}</Text>
            <Text style={s.body}>{m.note || fmt(m.createdAt)}</Text>
          </LinearGradient>
        </View>
      ))}
    </PagerView>
  );
}

function Settings() {
  const { trips, memories, trash, activeTrip, storageError, importTrip, cleanStorage } = useJourney();
  const { prefs, setPrefs } = usePrefs();
  const media = memories.filter(m => !!m.uri).length;
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [storageReport, setStorageReport] = useState<JourneyStorageReport>();

  const refreshStorage = () => {
    try {
      setStorageReport(
        inspectJourneyStorage(
          [...memories, ...trash]
            .flatMap(memory => (memory.uri ? [memory.uri] : []))
            .concat(trips.flatMap(trip => (trip.coverUri ? [trip.coverUri] : [])))
        )
      );
    } catch (e) {
      Alert.alert('Không thể đọc dung lượng', e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(refreshStorage, [memories]);

  const progress = (verb: string) => (done: number, total: number) =>
    setBackupStatus(total ? `${verb} ${Math.min(100, Math.round((done / total) * 100))}%` : verb);

  const exportBackup = async () => {
    if (!activeTrip) return;
    setBackupBusy(true);
    setBackupStatus('Đang chuẩn bị bản sao lưu…');
    let output: import('expo-file-system').File | undefined;
    try {
      output = await createTripBackup(activeTrip, [...memories, ...trash], progress('Đang sao lưu'));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị không hỗ trợ bảng chia sẻ file.');
      await Sharing.shareAsync(output.uri, {
        mimeType: 'application/octet-stream',
        UTI: 'public.data',
        dialogTitle: `Sao lưu ${activeTrip.title}`,
      });
      setBackupStatus('Đã tạo bản sao lưu.');
    } catch (e) {
      setBackupStatus('');
      Alert.alert('Không thể sao lưu', e instanceof Error ? e.message : String(e));
    } finally {
      if (output?.exists) output.delete();
      setBackupBusy(false);
    }
  };

  const importBackup = async () => {
    setBackupBusy(true);
    setBackupStatus('Đang chọn bản sao lưu…');
    let createdUris: string[] = [];
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) {
        setBackupStatus('');
        return;
      }
      const restored = await readTripBackup(picked.assets[0].uri, progress('Đang khôi phục'));
      createdUris = restored.createdUris;
      setBackupStatus('Đang ghi dữ liệu vào thiết bị…');
      const trip = await importTrip(restored.data.trip, restored.data.memories);
      setBackupStatus(`Đã khôi phục “${trip.title}”.`);
      Alert.alert('Khôi phục hoàn tất', `Đã thêm chuyến đi “${trip.title}” và ${restored.data.memories.length} kỷ niệm.`);
    } catch (e) {
      createdUris.forEach(removeJourneyAsset);
      setBackupStatus('');
      Alert.alert('Không thể khôi phục', e instanceof Error ? e.message : String(e));
    } finally {
      setBackupBusy(false);
    }
  };

  const toggleAutoGeoTag = async () => {
    if (prefs.autoGeoTag) {
      setPrefs({ autoGeoTag: false });
      return;
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Cần quyền vị trí để tự gắn GPS khi chụp hoặc quay.');
      setPrefs({ autoGeoTag: true });
    } catch (e) {
      Alert.alert('Không thể bật GPS tự động', e instanceof Error ? e.message : String(e));
    }
  };

  const cleanupState = useRef({ memories, trash, trips, storageError, backupBusy });
  cleanupState.current = { memories, trash, trips, storageError, backupBusy };

  const cleanOrphans = () =>
    Alert.alert('Dọn file không dùng?', 'Chỉ xóa file không còn được tham chiếu và đã tồn tại hơn một giờ.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Dọn',
        onPress: async () => {
          try {
            const current = cleanupState.current;
            if (current.storageError || current.backupBusy)
              throw new Error('Chờ thao tác lưu trữ hoàn tất rồi thử lại.');
            const count = await cleanStorage();
            refreshStorage();
            Alert.alert('Đã dọn dung lượng', `${count} file đã xóa. File mới được giữ lại để tránh gián đoạn lưu dữ liệu.`);
          } catch (error) {
            Alert.alert('Không thể dọn', String(error));
          }
        },
      },
    ]);

  return (
    <View style={s.stack}>
      <TrashAndDeviceSettings />

      {/* METRICS */}
      <View style={s.stats}>
        <GlassCard style={s.statCard}>
          <Text style={s.stat}>{trips.length}</Text>
          <Text style={s.label}>CHUYẾN ĐI</Text>
        </GlassCard>
        <GlassCard style={s.statCard}>
          <Text style={s.stat}>{memories.length}</Text>
          <Text style={s.label}>KỶ NIỆM</Text>
        </GlassCard>
        <GlassCard style={s.statCard}>
          <Text style={s.stat}>{media}</Text>
          <Text style={s.label}>FILE CỤC BỘ</Text>
        </GlassCard>
      </View>

      {/* GPS AUTO-TAG */}
      <GlassCard style={s.card}>
        <Text style={s.title}>Vị trí khi chụp và quay</Text>
        <Text style={s.body}>
          Khi bật, ứng dụng tự động gắn tọa độ vào ảnh và video mới. Dữ liệu chỉ lưu trong kỷ niệm và file sao lưu của bạn.
        </Text>
        <GlassButton
          title={prefs.autoGeoTag ? 'Tự gắn GPS: Đang bật' : 'Tự gắn GPS: Đang tắt'}
          variant={prefs.autoGeoTag ? 'accent-glass' : 'glass'}
          onPress={() => void toggleAutoGeoTag()}
        />
      </GlassCard>

      {/* BACKUP & RESTORE */}
      <GlassCard style={s.card}>
        <Text style={s.title}>Sao lưu chuyến đi</Text>
        <Text style={s.body}>
          File .travelmap chứa toàn bộ dữ liệu và media của chuyến đang chọn. Khôi phục luôn tạo chuyến mới an toàn.
        </Text>
        <GlassButton
          title={backupBusy ? 'Đang xử lý…' : activeTrip ? 'Sao lưu chuyến đang chọn' : 'Chưa có chuyến để sao lưu'}
          variant="primary"
          disabled={backupBusy || !activeTrip}
          onPress={() => void exportBackup()}
        />
        <GlassButton
          title="Khôi phục từ file .travelmap"
          variant="glass"
          disabled={backupBusy || !!storageError}
          onPress={() => void importBackup()}
        />
        {!!backupStatus && <Text style={s.body}>{backupStatus}</Text>}
      </GlassCard>

      {/* STORAGE REPORT */}
      <GlassCard style={s.card}>
        <Text style={s.title}>Dung lượng cục bộ</Text>
        <Text style={s.body}>
          {storageReport
            ? `${fmtBytes(storageReport.totalBytes)} tổng cộng · ${fmtBytes(storageReport.orphanBytes)} không còn sử dụng`
            : 'Đang tính dung lượng…'}
        </Text>
        {!!storageReport?.missingUris.length && (
          <Text style={s.error}>
            {storageReport.missingUris.length} kỷ niệm đang tham chiếu file đã mất. Hãy khôi phục từ backup nếu có.
          </Text>
        )}
        <GlassButton
          title={storageReport?.orphanUris.length ? `Dọn ${storageReport.orphanUris.length} file không dùng` : 'Không có file mồ côi'}
          variant="glass"
          disabled={!storageReport?.orphanUris.length}
          onPress={cleanOrphans}
        />
        <GlassButton title="Quét lại dung lượng" variant="glass" onPress={refreshStorage} />
      </GlassCard>

      {/* PRIVACY & VERSION */}
      <GlassCard style={s.card}>
        <Text style={s.title}>Lưu trữ riêng tư & Bảo mật</Text>
        <Text style={s.body}>
          Toàn bộ dữ liệu nằm trực tiếp trên thiết bị của bạn. Travel Memory Map không tải dữ liệu lên máy chủ công cộng.
        </Text>
        <Text style={s.versionText}>Travel Memory Map v1 · Expo SDK 58 · iOS Modern</Text>
      </GlassCard>
    </View>
  );
}

export default function JourneyFeature({ scene, id }: { scene: JourneyScene; id?: string }) {
  const { memories } = useJourney();
  const memory = memories.find(m => m.id === id);

  switch (scene) {
    case 'edit-trip':
      return <EditTrip />;
    case 'trip-map':
      return <TripMap />;
    case 'place-detail':
    case 'memory-detail':
      return <MemoryDetail memory={memory} />;
    case 'timeline':
      return <Timeline />;
    case 'capture-review':
      return <MemoryDetail memory={memory} review />;
    case 'media-picker':
      return <MediaPickerScreen />;
    case 'audio-recorder':
      return <RecorderScreen />;
    case 'audio-review':
      return <MemoryDetail memory={memory} review />;
    case 'document-picker':
      return <DocumentScreen />;
    case 'edit-memory':
      return <EditMemory memory={memory} />;
    case 'gallery':
      return <Gallery />;
    case 'story':
      return <Story />;
    case 'settings':
      return <Settings />;
    default:
      return null;
  }
}

const s = StyleSheet.create({
  stack: { gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  card: { padding: 18, gap: 10 },

  notice: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    borderStyle: 'dashed',
  },
  noticeSymbolWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 179, 64, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeSymbol: { fontSize: 32 },
  noticeTitle: { fontSize: 18, color: C.white, fontWeight: '800', textAlign: 'center' },
  noticeDetail: { fontSize: 13, lineHeight: 20, color: C.muted, textAlign: 'center' },

  title: { fontSize: 17, color: C.white, fontWeight: '800' },
  heading: { fontSize: 24, lineHeight: 30, color: C.white, fontWeight: '900' },
  body: { fontSize: 13, lineHeight: 20, color: C.muted },
  label: { fontSize: 10, letterSpacing: 1.5, color: C.muted, fontWeight: '800' },
  error: { color: C.danger, fontWeight: '700', fontSize: 12 },
  versionText: { fontSize: 11, color: C.dim, fontWeight: '600', marginTop: 4 },

  filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: C.white,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },

  detailCard: { padding: 18, gap: 12 },
  detailNote: { fontSize: 14, lineHeight: 22, color: C.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 179, 64, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagIcon: { fontSize: 11 },
  tag: { fontSize: 10, letterSpacing: 1.2, color: C.accent, fontWeight: '900' },

  media: { width: '100%', height: 350, borderRadius: 22, backgroundColor: '#02070d' },
  miniMapWrap: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder },
  miniMap: { height: 180 },

  player: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  playerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 179, 64, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerIcon: { fontSize: 24 },
  playerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  playerTime: { fontSize: 12, color: C.muted, fontWeight: '600' },

  recorder: { minHeight: 380, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  recordOrb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 2,
    borderColor: C.glassBorder,
  },
  recording: {
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    borderColor: C.danger,
  },
  recordIcon: { fontSize: 44, color: C.danger },
  time: { fontSize: 44, color: C.white, fontWeight: '900', fontVariant: ['tabular-nums'] },

  mapWrap: { height: 520, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder },
  map: { ...StyleSheet.absoluteFill },
  mapEmpty: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(7, 10, 17, 0.88)',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  mapEmptyText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  mapFit: {
    position: 'absolute',
    right: 14,
    top: 14,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 10, 17, 0.85)',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  mapFitText: { fontSize: 12, color: C.white, fontWeight: '800' },

  timeline: { flexDirection: 'row', gap: 12 },
  timelineRail: { width: 16, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent, marginTop: 18 },
  line: { width: 2, flex: 1, backgroundColor: C.glassBorder, marginTop: 4 },
  timelineCard: { flex: 1, padding: 14, gap: 8 },
  timelineMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineTime: { fontSize: 11, color: C.dim, fontWeight: '600' },
  starIcon: { color: C.accent, fontSize: 14 },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  timelineMedia: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#02070d' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%', gap: 6 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  videoIcon: { fontSize: 32, color: C.white },
  gridVideoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gridVideoBadgeText: { fontSize: 10, color: C.white, fontWeight: '700' },
  gridTitle: { fontSize: 13, color: C.white, fontWeight: '700', paddingHorizontal: 2 },

  pager: { height: 580, borderRadius: 24, overflow: 'hidden' },
  story: { flex: 1, justifyContent: 'center', backgroundColor: '#02070d' },
  storyPlaceholder: { width: '100%', height: 350, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07101C' },
  storyCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, paddingTop: 80, gap: 8 },

  stats: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 4 },
  stat: { fontSize: 24, color: C.white, fontWeight: '900', textAlign: 'center' },

  zoomHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(7, 10, 17, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  zoomHintText: { fontSize: 10, fontWeight: '700', color: C.white },

  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
