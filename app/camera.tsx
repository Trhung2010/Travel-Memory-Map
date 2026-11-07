import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
  type FlashMode,
} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Action, BottomNav } from '../src/components/Ui';
import { GlassButton, GlassCard, GlassPill } from '../src/components/GlassUi';
import { keepPhoto } from '../src/lib/gallery';
import { usePrefs } from '../src/state/Prefs';
import { C } from '../src/theme/colors';
import { useJourney } from '../src/journey/JourneyContext';
import { persistJourneyAssetCommitted } from '../src/journey/media';

const flashModes: FlashMode[] = ['off', 'auto', 'on'];
type CaptureKind = 'photo' | 'video';

export default function CameraScreen({
  mode = 'normal',
  journeyMode = false,
  initialCapture = 'photo',
}: {
  mode?: 'normal' | 'pro';
  journeyMode?: boolean;
  initialCapture?: CaptureKind;
}) {
  const pro = mode === 'pro';
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const { width } = useWindowDimensions();
  const [stageHeight, setStageHeight] = useState(width);
  const alive = useRef(false),
    session = useRef(0),
    busy = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [focused, setFocused] = useState(false),
    [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [facing, setFacing] = useState<CameraType>('back'),
    [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0),
    [autoFocusEnabled, setAutoFocusEnabled] = useState(true),
    [ready, setReady] = useState(false),
    [shooting, setShooting] = useState(false);
  const [captureKind, setCaptureKind] = useState<CaptureKind>(journeyMode ? initialCapture : 'photo'),
    [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [proControlsOpen, setProControlsOpen] = useState(false);
  const [countdown, setCountdown] = useState(0),
    [error, setError] = useState<string | null>(null);
  const { prefs, setPrefs } = usePrefs();
  const { activeTrip, createMemory } = useJourney();

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      session.current++;
      setFocused(true);
      setProControlsOpen(false);
      return () => {
        if (busy.current) camera.current?.stopRecording();
        alive.current = false;
        session.current++;
        setFocused(false);
        setReady(false);
        setRecording(false);
      };
    }, [])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && busy.current) camera.current?.stopRecording();
      session.current++;
      setReady(false);
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const go = (scene: string) => router.push({ pathname: '/studio/[scene]', params: { scene } });
  const switchFacing = () => {
    if (busy.current) return;
    session.current++;
    setReady(false);
    setFacing(v => (v === 'back' ? 'front' : 'back'));
  };

  const selectCaptureKind = (kind: CaptureKind) => {
    if (busy.current || kind === captureKind) return;
    session.current++;
    setReady(false);
    setCaptureKind(kind);
  };

  const captureLocation = async () => {
    if (!journeyMode || !prefs.autoGeoTag) return {};
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        setPrefs({ autoGeoTag: false });
        Alert.alert(
          'Đã tắt tự gắn GPS',
          'Quyền vị trí không còn được cấp. Ảnh và video vẫn được lưu nhưng không có tọa độ.'
        );
        return {};
      }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 });
      if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      return await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(position => ({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })),
        new Promise<{}>(resolve => {
          timeout = setTimeout(() => resolve({}), 5000);
        }),
      ]);
    } catch {
      return {};
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const shootPhoto = async () => {
    if (!camera.current || !ready || busy.current || !appActive) return;
    setProControlsOpen(false);
    busy.current = true;
    const token = session.current;
    const valid = () => alive.current && token === session.current && AppState.currentState === 'active';
    setError(null);
    setShooting(true);
    try {
      for (let n = prefs.timer; n > 0; n--) {
        if (!valid()) return;
        setCountdown(n);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!valid()) return;
      setCountdown(0);
      const result = await camera.current.takePictureAsync({
        quality: prefs.quality,
        exif: true,
        skipProcessing: false,
      });
      if (!result?.uri || !result.width || !result.height) throw new Error('Camera không trả về ảnh hợp lệ');
      const side = Math.min(result.width, result.height);
      const cropped = await ImageManipulator.manipulateAsync(
        result.uri,
        [{ crop: { originX: Math.floor((result.width - side) / 2), originY: Math.floor((result.height - side) / 2), width: side, height: side } }],
        { compress: prefs.quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (!valid()) return;
      if (valid() && journeyMode && activeTrip) {
        const coordinatesPromise = captureLocation();
        const memory = await persistJourneyAssetCommitted(
          cropped.uri,
          `photo-${Date.now()}.jpg`,
          async saved => {
            const coordinates = await coordinatesPromise;
            if (!valid()) throw new Error('Phiên camera đã kết thúc.');
            return createMemory({
              tripId: activeTrip.id,
              kind: 'photo',
              title: `Ảnh tại ${activeTrip.destination}`,
              note: '',
              uri: saved.uri,
              fileName: saved.fileName,
              ...coordinates,
            });
          }
        );
        router.replace({ pathname: '/journey/[scene]', params: { scene: 'capture-review', id: memory.id } });
      } else if (valid()) {
        const saved = await keepPhoto(cropped.uri);
        router.push({ pathname: '/studio/[scene]', params: { scene: 'review', name: saved.name } });
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setShooting(false);
      setCountdown(0);
    }
  };

  const recordVideo = async () => {
    if (Platform.OS === 'web') {
      setError('Quay video trực tiếp chưa hỗ trợ trên web. Dùng nút nhập ảnh/video hoặc mở ứng dụng bằng Expo Go.');
      return;
    }
    if (recording) {
      camera.current?.stopRecording();
      return;
    }
    if (!camera.current || !ready || busy.current || !appActive || !journeyMode || !activeTrip) return;
    busy.current = true;
    const token = session.current;
    const valid = () => alive.current && token === session.current && AppState.currentState === 'active';
    setShooting(true);
    try {
      let mic = microphonePermission;
      if (!mic?.granted) {
        mic = await requestMicrophonePermission();
        if (!mic.granted) throw new Error('Cần quyền micro để quay video có âm thanh.');
      }
      if (!valid()) return;
      setRecordedSeconds(0);
      setRecording(true);
      const result = await camera.current.recordAsync({ maxDuration: 60 });
      setRecording(false);
      if (!valid()) return;
      if (!result?.uri) throw new Error('Camera không trả về video hợp lệ.');
      const extension = result.uri.split(/[?#]/)[0].match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]?.toLowerCase() || 'mp4';
      const coordinatesPromise = captureLocation();
      const memory = await persistJourneyAssetCommitted(
        result.uri,
        `video-${Date.now()}.${extension}`,
        async saved => {
          const coordinates = await coordinatesPromise;
          if (!valid()) throw new Error('Phiên camera đã kết thúc.');
          return createMemory({
            tripId: activeTrip.id,
            kind: 'video',
            title: `Video tại ${activeTrip.destination}`,
            note: '',
            uri: saved.uri,
            fileName: saved.fileName,
            mimeType: extension === 'mov' ? 'video/quicktime' : 'video/mp4',
            ...coordinates,
          });
        }
      );
      router.replace({ pathname: '/journey/[scene]', params: { scene: 'capture-review', id: memory.id } });
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setRecording(false);
      setShooting(false);
    }
  };

  const capture = () => (captureKind === 'video' ? recordVideo() : shootPhoto());

  if (journeyMode && !activeTrip)
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.logo}>TRAVEL</Text>
        <Text style={s.muted}>Tạo hoặc chọn một chuyến đi trước khi chụp kỷ niệm.</Text>
        <GlassButton
          title="Tạo chuyến đi"
          variant="primary"
          onPress={() => router.replace({ pathname: '/journey/[scene]', params: { scene: 'create-trip' } })}
        />
      </SafeAreaView>
    );

  if (!permission)
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.accent} />
        <Text style={s.muted}>Đang kiểm tra camera…</Text>
      </SafeAreaView>
    );

  if (!permission.granted)
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.logo}>TRAVEL</Text>
        <Text style={s.muted}>Cho phép quyền camera để chụp và lưu giữ kỷ niệm trên thiết bị.</Text>
        <GlassButton
          title={permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt quyền'}
          variant="primary"
          onPress={() => {
            void (permission.canAskAgain ? requestPermission() : Linking.openSettings());
          }}
        />
        <GlassButton
          title="Mở thư viện"
          variant="glass"
          onPress={() =>
            journeyMode
              ? router.replace({ pathname: '/journey/[scene]', params: { scene: 'gallery' } })
              : go('library')
          }
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.page} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          style={s.headerBack}
          onPress={() =>
            journeyMode
              ? router.replace({ pathname: '/journey/[scene]', params: { scene: 'trip-overview' } })
              : router.push({ pathname: '/journey/[scene]', params: { scene: 'home' } })
          }
        >
          <Text style={s.headerBackIcon}>‹</Text>
        </Pressable>

        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>{activeTrip ? activeTrip.destination : 'CAMERA'}</Text>
          <Text style={s.headerSub}>{captureKind === 'video' ? 'QUAY VIDEO' : 'CHỤP ẢNH'}</Text>
        </View>

        {!pro && captureKind === 'photo' && (
          <Pressable
            accessibilityRole="button"
            style={s.flashBtn}
            disabled={shooting}
            onPress={() => setFlash(v => flashModes[(flashModes.indexOf(v) + 1) % 3])}
          >
            <Text style={s.flashIcon}>⚡</Text>
            <Text style={s.flashText}>
              {flash === 'off' ? 'Tắt' : flash === 'auto' ? 'Auto' : 'Bật'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* VIEWFINDER STAGE */}
      <View style={s.stage} onLayout={event => setStageHeight(event.nativeEvent.layout.height)}>
        <View style={[s.viewfinder, { width: Math.min(width - 24, Math.max(120, stageHeight - 24)) }]}>
          {focused && appActive && (
            <CameraView
              key={`${facing}-${captureKind}`}
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              zoom={zoom}
              autofocus={autoFocusEnabled ? 'on' : 'off'}
              ratio="4:3"
              mode={journeyMode && captureKind === 'video' ? 'video' : 'picture'}
              onCameraReady={() => {
                if (alive.current) {
                  setReady(true);
                  setError(null);
                }
              }}
              onRecordingProgress={({ duration }) => setRecordedSeconds(Math.floor(duration))}
              onMountError={e => {
                setError(e.message);
                setReady(false);
              }}
            />
          )}

          {prefs.grid && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={[s.vline, { left: '33.33%' }]} />
              <View style={[s.vline, { left: '66.66%' }]} />
              <View style={[s.hline, { top: '33.33%' }]} />
              <View style={[s.hline, { top: '66.66%' }]} />
            </View>
          )}

          {recording && (
            <View pointerEvents="none" style={s.recordBadge}>
              <Text style={s.recordDot}>●</Text>
              <Text style={s.recordText}>Đang quay · {recordedSeconds} / 60s</Text>
            </View>
          )}

          {countdown > 0 && (
            <View style={s.overlay}>
              <Text style={s.countdown}>{countdown}</Text>
            </View>
          )}

          {error && (
            <View style={s.overlay}>
              <Text style={s.error}>{error}</Text>
            </View>
          )}

          {!ready && !error && (
            <View style={s.spinner}>
              <ActivityIndicator color={C.accent} size="large" />
            </View>
          )}
        </View>

        {/* PRO CONTROLS TAB */}
        {pro && !proControlsOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở điều khiển Pro"
            style={s.proTab}
            onPress={() => setProControlsOpen(true)}
          >
            <Text style={s.proTabIcon}>⚙️</Text>
            <Text style={s.proTabText}>PRO</Text>
          </Pressable>
        )}

        {/* PRO DRAWER */}
        {pro && proControlsOpen && (
          <View style={[s.proDrawer, { width: Math.min(280, width * 0.74) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng điều khiển Pro"
              style={s.proClose}
              onPress={() => setProControlsOpen(false)}
            >
              <Text style={s.proCloseText}>Đóng ✕</Text>
            </Pressable>
            <ScrollView contentContainerStyle={s.proContent} showsVerticalScrollIndicator={false}>
              <Text style={s.proTitle}>FLASH</Text>
              <View style={s.proChips}>
                {flashModes.map(v => (
                  <GlassPill
                    key={v}
                    title={v === 'off' ? 'Tắt' : v === 'auto' ? 'Tự động' : 'Bật'}
                    active={flash === v}
                    onPress={() => setFlash(v)}
                  />
                ))}
              </View>

              <Text style={s.proTitle}>ZOOM</Text>
              <View style={s.proChips}>
                {[0, 0.25, 0.5, 0.75, 1].map(v => (
                  <GlassPill
                    key={v}
                    title={`${Math.round(v * 100)}%`}
                    active={zoom === v}
                    onPress={() => setZoom(v)}
                  />
                ))}
              </View>

              <Text style={s.proTitle}>HẸN GIỜ</Text>
              <View style={s.proChips}>
                {([0, 3, 5, 10] as const).map(v => (
                  <GlassPill
                    key={v}
                    title={v ? `${v}s` : 'Tắt'}
                    active={prefs.timer === v}
                    onPress={() => setPrefs({ timer: v })}
                  />
                ))}
              </View>

              <Text style={s.proTitle}>LẤY NÉT TỰ ĐỘNG</Text>
              <View style={s.proChips}>
                <GlassPill
                  title={autoFocusEnabled ? 'Bật' : 'Tắt'}
                  active={autoFocusEnabled}
                  onPress={() => setAutoFocusEnabled(v => !v)}
                />
              </View>

              <Text style={s.proTitle}>LƯỚI KHUNG NGẮM</Text>
              <View style={s.proChips}>
                <GlassPill
                  title={prefs.grid ? 'Bật' : 'Tắt'}
                  active={prefs.grid}
                  onPress={() => setPrefs({ grid: !prefs.grid })}
                />
              </View>

              <Text style={s.proTitle}>ĐỔI CAMERA</Text>
              <View style={s.proChips}>
                <GlassPill title={facing === 'back' ? 'Sau ➔ Trước' : 'Trước ➔ Sau'} active={false} onPress={switchFacing} />
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* QUICK MODE SWITCHER */}
      {journeyMode && (
        <View style={s.modeSwitcherRow}>
          <GlassPill
            title="Ảnh"
            icon="📸"
            active={captureKind === 'photo'}
            onPress={() => selectCaptureKind('photo')}
          />
          <GlassPill
            title="Video"
            icon="🎥"
            active={captureKind === 'video'}
            onPress={() => selectCaptureKind('video')}
          />
        </View>
      )}

      {/* QUICK TOOLS (TIMER & CAMERA SWITCH) */}
      {!pro && (
        <View style={s.toolsRow}>
          {captureKind === 'photo' && (
            <Pressable
              accessibilityRole="button"
              style={s.toolBtn}
              disabled={shooting}
              onPress={() => {
                const timers = [0, 3, 5, 10] as const;
                setPrefs({ timer: timers[(timers.indexOf(prefs.timer) + 1) % timers.length] });
              }}
            >
              <Text style={s.toolText}>⏱️ {prefs.timer ? `${prefs.timer}s` : 'Hẹn giờ'}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" style={s.toolBtn} disabled={shooting} onPress={switchFacing}>
            <Text style={s.toolText}>🔄 Đổi camera</Text>
          </Pressable>
        </View>
      )}

      {/* SHUTTER & SHORTCUTS ROW */}
      <View style={s.shutterRow}>
        {/* GALLERY BUTTON */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở thư viện ảnh"
          style={s.sideIconBtn}
          onPress={() =>
            journeyMode
              ? router.push({ pathname: '/journey/[scene]', params: { scene: 'gallery' } })
              : go('library')
          }
        >
          <Text style={s.sideIcon}>🖼️</Text>
        </Pressable>

        {/* MAIN SHUTTER BUTTON */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recording ? 'Dừng quay video' : captureKind === 'video' ? 'Quay video' : 'Chụp ảnh'
          }
          disabled={!ready || (shooting && !recording)}
          onPress={() => void capture()}
          style={[
            s.shutterOuter,
            !ready && { opacity: 0.4 },
            captureKind === 'video' && s.shutterOuterVideo,
            recording && s.shutterRecording,
          ]}
        >
          <View
            style={[
              s.shutterInner,
              captureKind === 'video' && s.videoCore,
              recording && s.stopCore,
            ]}
          >
            {shooting && !recording && <ActivityIndicator color={C.bg} />}
          </View>
        </Pressable>

        {/* MEDIA PICKER BUTTON */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={journeyMode ? 'Nhập ảnh hoặc video' : 'Mở bộ lọc'}
          style={s.sideIconBtn}
          onPress={() =>
            journeyMode
              ? router.push({ pathname: '/journey/[scene]', params: { scene: 'media-picker' } })
              : go('filters')
          }
        >
          <Text style={s.sideIcon}>📥</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  logo: { color: C.white, fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  muted: { color: C.muted, textAlign: 'center', lineHeight: 22, fontSize: 14 },

  // HEADER
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackIcon: { fontSize: 24, color: C.accent, lineHeight: 26 },
  headerTitleWrap: { alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 1.5 },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  flashIcon: { fontSize: 12 },
  flashText: { fontSize: 11, fontWeight: '700', color: C.white },

  // STAGE & VIEWFINDER
  stage: { flex: 1, minHeight: 120, justifyContent: 'center', alignItems: 'center' },
  viewfinder: {
    aspectRatio: 1,
    backgroundColor: '#05070B',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorderHighlight,
  },
  vline: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  hline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  countdown: { fontSize: 80, color: C.white, fontWeight: '900' },
  error: { color: C.danger, textAlign: 'center', padding: 20, fontWeight: '700' },
  spinner: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -16 }, { translateY: -16 }] },

  // RECORDING
  recordBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 69, 58, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordDot: { color: C.danger, fontSize: 10 },
  recordText: { color: C.white, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },

  // PRO DRAWER
  proTab: {
    position: 'absolute',
    right: 0,
    top: '35%',
    backgroundColor: C.glassElevated,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  proTabIcon: { fontSize: 18 },
  proTabText: { color: C.white, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  proDrawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 16, 26, 0.94)',
    borderLeftWidth: 1,
    borderColor: C.glassBorderHighlight,
    zIndex: 10,
  },
  proClose: {
    height: 48,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  proCloseText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  proContent: { padding: 16, gap: 10, paddingBottom: 30 },
  proTitle: { color: C.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  proChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // SWITCHER & TOOLS
  modeSwitcherRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  toolsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 6 },
  toolBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  toolText: { color: C.white, fontSize: 12, fontWeight: '700' },

  // SHUTTER ROW
  shutterRow: {
    height: 100,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sideIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIcon: { fontSize: 22 },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  shutterOuterVideo: { borderColor: 'rgba(255, 69, 58, 0.4)' },
  shutterRecording: { borderColor: C.danger },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCore: { backgroundColor: C.danger },
  stopCore: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.danger },
});
