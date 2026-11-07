import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useJourney } from './JourneyContext';
import { SCENE_DEFINITIONS, type JourneyScene } from './scenes';
import CameraScreen from '../../app/camera';
import { localDateString } from './validation';
import JourneyFeature from './JourneyFeatures';
import TripOverview from './TripOverview';
import {
  GlassButton,
  GlassCard,
  GlassHeader,
  GlassInput,
  StatusBadge,
} from '../components/GlassUi';
import { C, GRADIENTS } from '../theme/colors';

const ATTACHMENT_ACTIONS: ReadonlyArray<{
  scene: JourneyScene;
  label: string;
  sub: string;
  icon: string;
}> = [
  { scene: 'media-picker', label: 'Nhập ảnh hoặc video', sub: 'Từ thư viện ảnh trên thiết bị', icon: '🖼️' },
  { scene: 'audio-recorder', label: 'Ghi âm hành trình', sub: 'Thu lại âm thanh và cảm xúc', icon: '🎙️' },
  { scene: 'edit-memory', label: 'Viết nhật ký & ghi chú', sub: 'Lưu lại câu chuyện và vị trí', icon: '📝' },
  { scene: 'document-picker', label: 'Đính kèm tài liệu', sub: 'Vé điện tử, PDF, lịch trình', icon: '📄' },
];

function EmptyTripView({ go }: { go: (scene: JourneyScene) => void }) {
  return (
    <GlassCard style={styles.emptyCard}>
      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyIcon}>🧭</Text>
      </View>
      <Text style={styles.emptyTitle}>Chưa có hành trình nào</Text>
      <Text style={styles.emptyDetail}>
        Hãy tạo chuyến đi đầu tiên để bắt đầu lưu giữ các kỷ niệm, hình ảnh và vị trí trên bản đồ.
      </Text>
      <GlassButton
        title="＋ Bắt đầu chuyến đi"
        variant="primary"
        onPress={() => go('create-trip')}
      />
    </GlassCard>
  );
}

export default function JourneySceneScreen({
  scene,
  id,
  capture,
}: {
  scene: JourneyScene;
  id?: string;
  capture?: 'video' | 'photo';
}) {
  return scene === 'camera' ? (
    <CameraScreen key={capture} journeyMode initialCapture={capture} />
  ) : (
    <JourneyContent scene={scene} id={id} />
  );
}

function JourneyContent({
  scene,
  id,
}: {
  scene: Exclude<JourneyScene, 'camera'>;
  id?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, storageError, trips, activeTrip, setActiveTripId, createTrip } = useJourney();

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(localDateString);
  const [endDate, setEndDate] = useState(localDateString);
  const [formError, setFormError] = useState('');
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const definition = SCENE_DEFINITIONS[scene];

  const go = (target: JourneyScene, extra: Record<string, string> = {}) =>
    router.push({ pathname: '/journey/[scene]', params: { scene: target, ...extra } });

  const back = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/journey/[scene]', params: { scene: 'home' } });

  const body = () => {
    if (!ready) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Đang tải dữ liệu hành trình…</Text>
        </View>
      );
    }

    // --- HOME SCENE ---
    if (scene === 'home') {
      return (
        <>
          {/* HERO BANNER */}
          <GlassCard style={styles.heroCard}>
            <LinearGradient
              colors={GRADIENTS.heroGlow}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeDot}>✦</Text>
              <Text style={styles.heroBadgeText}>TRAVEL MEMORY MAP</Text>
            </View>
            <Text style={styles.heroHeading}>Mỗi nơi đến,{`\n`}một câu chuyện.</Text>
            <Text style={styles.heroSubhead}>
              Ghi lại ảnh, âm thanh, dấu chân và câu chuyện cảm xúc trên cùng một hành trình.
            </Text>
            <View style={styles.heroActionRow}>
              <GlassButton
                title="＋ Tạo chuyến đi mới"
                variant="primary"
                onPress={() => go('create-trip')}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>

          {/* QUICK ACCESS GRID */}
          <View style={styles.quickDock}>
            {(
              [
                ['trip-map', 'Bản đồ', '📍'],
                ['timeline', 'Timeline', '⏱️'],
                ['gallery', 'Thư viện', '🖼️'],
                ['settings', 'Cài đặt', '⚙️'],
              ] as const
            ).map(([target, label, icon]) => (
              <Pressable
                key={target}
                accessibilityRole="button"
                style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
                onPress={() => go(target)}
              >
                <Text style={styles.quickIcon}>{icon}</Text>
                <Text style={styles.quickLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* RECENT TRIPS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CHUYẾN ĐI GẦN ĐÂY</Text>
            <Pressable accessibilityRole="button" onPress={() => go('trips')}>
              <Text style={styles.sectionLink}>Xem tất cả ›</Text>
            </Pressable>
          </View>

          {!trips.length ? (
            <EmptyTripView go={go} />
          ) : (
            trips.slice(0, 3).map(trip => (
              <Pressable
                key={trip.id}
                accessibilityRole="button"
                style={({ pressed }) => [styles.tripCardWrap, pressed && styles.pressed]}
                onPress={() => {
                  setActiveTripId(trip.id);
                  go('trip-overview');
                }}
              >
                <GlassCard style={styles.tripCardInner}>
                  {trip.coverUri ? (
                    <Image source={{ uri: trip.coverUri }} style={styles.tripThumb} />
                  ) : (
                    <LinearGradient colors={GRADIENTS.hero} style={[styles.tripThumb, styles.tripThumbPlaceholder]}>
                      <Text style={styles.tripThumbIcon}>🗺️</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.tripInfo}>
                    <StatusBadge status={trip.status} />
                    <Text numberOfLines={1} style={styles.tripTitle}>
                      {trip.title}
                    </Text>
                    <Text style={styles.tripMeta}>
                      📍 {trip.destination} · {trip.startDate}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </GlassCard>
              </Pressable>
            ))
          )}
        </>
      );
    }

    // --- ALL TRIPS SCENE ---
    if (scene === 'trips') {
      return trips.length ? (
        <View style={styles.tripsList}>
          {trips.map(trip => (
            <Pressable
              key={trip.id}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => {
                setActiveTripId(trip.id);
                go('trip-overview');
              }}
            >
              <GlassCard style={styles.tripCardInner}>
                {trip.coverUri ? (
                  <Image source={{ uri: trip.coverUri }} style={styles.tripThumb} />
                ) : (
                  <LinearGradient colors={GRADIENTS.hero} style={[styles.tripThumb, styles.tripThumbPlaceholder]}>
                    <Text style={styles.tripThumbIcon}>🗺️</Text>
                  </LinearGradient>
                )}
                <View style={styles.tripInfo}>
                  <StatusBadge status={trip.status} />
                  <Text numberOfLines={1} style={styles.tripTitle}>
                    {trip.title}
                  </Text>
                  <Text style={styles.tripMeta}>📍 {trip.destination}</Text>
                  <Text style={styles.tripDateRange}>
                    {trip.startDate} → {trip.endDate}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyTripView go={go} />
      );
    }

    // --- CREATE TRIP SCENE ---
    if (scene === 'create-trip') {
      return (
        <GlassCard style={styles.formCard}>
          <GlassInput
            label="Tên chuyến đi"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder="Ví dụ: Khám phá Đà Lạt tháng 11"
          />
          <GlassInput
            label="Điểm đến"
            value={destination}
            onChangeText={setDestination}
            maxLength={100}
            placeholder="Thành phố hoặc địa danh"
          />
          <GlassInput
            label="Mô tả chuyến đi"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            placeholder="Bạn mong chờ điều gì ở chuyến đi này?"
            multiline
          />
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <GlassInput label="Bắt đầu" value={startDate} onChangeText={setStartDate} />
            </View>
            <View style={{ flex: 1 }}>
              <GlassInput label="Kết thúc" value={endDate} onChangeText={setEndDate} />
            </View>
          </View>

          {!!formError && <Text style={styles.errorText}>{formError}</Text>}

          <GlassButton
            title="Lưu hành trình"
            variant="primary"
            onPress={() => {
              try {
                setFormError('');
                createTrip({
                  title: title.trim(),
                  destination: destination.trim(),
                  description: description.trim(),
                  startDate,
                  endDate,
                });
                router.replace({ pathname: '/journey/[scene]', params: { scene: 'trip-overview' } });
              } catch (error) {
                setFormError(error instanceof Error ? error.message : 'Không thể tạo chuyến đi.');
              }
            }}
          />
        </GlassCard>
      );
    }

    // --- SETTINGS SCENE ---
    if (scene === 'settings') {
      return <JourneyFeature scene={scene} id={id} />;
    }

    // Require active trip for subsequent scenes
    if (!activeTrip) {
      return <EmptyTripView go={go} />;
    }

    // --- TRIP OVERVIEW SCENE ---
    if (scene === 'trip-overview') {
      return <TripOverview go={go} />;
    }

    // --- CREATE MEMORY SCENE ---
    if (scene === 'create-memory') {
      return (
        <View style={styles.createMemoryStack}>
          {/* CAMERA ACTION HERO */}
          <GlassCard style={styles.cameraBanner}>
            <LinearGradient
              colors={GRADIENTS.heroGlow}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeDot}>📷</Text>
              <Text style={styles.heroBadgeText}>CAMERA TRỰC TIẾP</Text>
            </View>
            <Text style={styles.cameraTitle}>{activeTrip.title}</Text>
            <Text style={styles.cameraSub}>Điểm đến: {activeTrip.destination}</Text>
            <View style={styles.cameraBtnRow}>
              <GlassButton
                title="Chụp ảnh"
                variant="primary"
                icon="📸"
                onPress={() => go('camera', { capture: 'photo' })}
                style={{ flex: 1 }}
              />
              <GlassButton
                title="Quay video"
                variant="glass"
                icon="🎥"
                onPress={() => go('camera', { capture: 'video' })}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>

          {/* ATTACHMENT OPTIONS */}
          <Text style={styles.sectionTitle}>HOẶC CHỌN NỘI DUNG KHÁC</Text>
          {ATTACHMENT_ACTIONS.map(action => (
            <Pressable
              key={action.scene}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => go(action.scene)}
            >
              <GlassCard style={styles.attachmentCard}>
                <View style={styles.attachmentIconCircle}>
                  <Text style={styles.attachmentIcon}>{action.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.attachmentLabel}>{action.label}</Text>
                  <Text style={styles.attachmentSub}>{action.sub}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      );
    }

    return <JourneyFeature scene={scene} id={id} />;
  };

  // FLOATING GLASS BOTTOM NAVIGATION
  const navTabs: [string, JourneyScene, string][] = [
    ['🏠', 'home', 'Home'],
    ['📍', 'trip-map', 'Bản đồ'],
    ['＋', 'create-memory', 'Thêm'],
    ['⏱️', 'timeline', 'Timeline'],
    ['🖼️', 'gallery', 'Media'],
  ];

  return (
    <View style={styles.rootContainer}>
      <LinearGradient colors={GRADIENTS.background} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <GlassHeader
          title={definition.title}
          eyebrow={definition.eyebrow}
          back={scene !== 'home' ? back : undefined}
          home={scene !== 'home' ? () => router.replace({ pathname: '/journey/[scene]', params: { scene: 'home' } }) : undefined}
          trailing={
            activeTrip && trips.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi chuyến đi"
                style={({ pressed }) => [styles.switcherPill, pressed && styles.pressed]}
                onPress={() => setSwitcherOpen(true)}
              >
                <Text numberOfLines={1} style={styles.switcherText}>
                  📍 {activeTrip.destination} ▾
                </Text>
              </Pressable>
            ) : undefined
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 110 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {!!storageError && (
              <GlassCard style={styles.storageErrorCard}>
                <Text style={styles.storageErrorText}>{storageError}</Text>
              </GlassCard>
            )}
            {body()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* FLOATING GLASS DOCK (iOS Style Bottom Nav) */}
        <View style={[styles.dockWrap, { bottom: Math.max(16, insets.bottom + 4) }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 35}
            tint="dark"
            style={styles.dockBlur}
          >
            <View style={styles.dockInner}>
              {navTabs.map(([icon, target, label]) => {
                const isActive = scene === target;
                const isCenter = target === 'create-memory';

                if (isCenter) {
                  return (
                    <Pressable
                      key={target}
                      accessibilityRole="button"
                      accessibilityLabel="Thêm kỷ niệm mới"
                      style={({ pressed }) => [styles.dockCenterBtnWrap, pressed && styles.pressed]}
                      onPress={() => router.replace({ pathname: '/journey/[scene]', params: { scene: target } })}
                    >
                      <LinearGradient
                        colors={GRADIENTS.accent}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.dockCenterBtn}
                      >
                        <Text style={styles.dockCenterBtnText}>＋</Text>
                      </LinearGradient>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={target}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    style={({ pressed }) => [
                      styles.dockItem,
                      isActive && styles.dockItemActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => router.replace({ pathname: '/journey/[scene]', params: { scene: target } })}
                  >
                    <Text style={[styles.dockIcon, isActive && styles.dockIconActive]}>{icon}</Text>
                    <Text style={[styles.dockLabel, isActive && styles.dockLabelActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </View>

        {/* TRIP SWITCHER MODAL */}
        <Modal
          visible={switcherOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSwitcherOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setSwitcherOpen(false)} />
            <GlassCard elevated highlight style={styles.switcherModal}>
              <View style={styles.switcherHead}>
                <Text style={styles.switcherTitle}>CHUYỂN CHUYẾN ĐI</Text>
                <Pressable onPress={() => setSwitcherOpen(false)}>
                  <Text style={styles.switcherClose}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {trips.map(t => {
                  const isCur = t.id === activeTrip?.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.switcherItem, isCur && styles.switcherItemActive]}
                      onPress={() => {
                        setActiveTripId(t.id);
                        setSwitcherOpen(false);
                      }}
                    >
                      <Text style={styles.switcherItemDot}>{isCur ? '●' : '○'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.switcherItemTitle, isCur && { color: C.accent }]}>
                          {t.title}
                        </Text>
                        <Text style={styles.switcherItemMeta}>
                          {t.destination} · {t.startDate}
                        </Text>
                      </View>
                      {isCur && <Text style={styles.switcherCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <GlassButton
                title="＋ Tạo chuyến đi mới"
                variant="primary"
                onPress={() => {
                  setSwitcherOpen(false);
                  go('create-trip');
                }}
              />
            </GlassCard>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: C.bg },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: 18,
    paddingBottom: 110, // clearance for floating dock
    gap: 18,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },

  loadingWrap: { minHeight: 340, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: C.muted, fontSize: 14, fontWeight: '600' },

  storageErrorCard: {
    backgroundColor: C.dangerGlass,
    borderColor: 'rgba(255, 69, 58, 0.3)',
    padding: 14,
  },
  storageErrorText: { color: C.danger, fontSize: 13, fontWeight: '700' },

  // HERO
  heroCard: {
    minHeight: 260,
    padding: 24,
    justifyContent: 'flex-end',
    gap: 12,
    overflow: 'hidden',
    borderColor: C.glassBorderHighlight,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 179, 64, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  heroBadgeDot: { color: C.accent, fontSize: 10 },
  heroBadgeText: { color: C.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  heroHeading: { color: C.white, fontSize: 32, fontWeight: '900', lineHeight: 38, letterSpacing: -0.5 },
  heroSubhead: { color: '#CBD5E1', fontSize: 14, lineHeight: 22 },
  heroActionRow: { marginTop: 6 },

  // QUICK DOCK
  quickDock: { flexDirection: 'row', gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: C.glassCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickIcon: { fontSize: 22 },
  quickLabel: { fontSize: 12, fontWeight: '700', color: C.text },

  // SECTIONS
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: C.muted },
  sectionLink: { fontSize: 13, fontWeight: '700', color: C.accent },

  // TRIPS
  tripsList: { gap: 12 },
  tripCardWrap: { borderRadius: 22 },
  tripCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  tripThumb: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#090D15' },
  tripThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  tripThumbIcon: { fontSize: 28 },
  tripInfo: { flex: 1, gap: 4 },
  tripTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  tripMeta: { fontSize: 12, color: C.muted, fontWeight: '600' },
  tripDateRange: { fontSize: 11, color: C.dim },
  chevron: { fontSize: 24, color: C.accent, fontWeight: '700' },

  // EMPTY
  emptyCard: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, borderStyle: 'dashed' },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 179, 64, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.white, textAlign: 'center' },
  emptyDetail: { fontSize: 13, lineHeight: 20, color: C.muted, textAlign: 'center' },

  // FORM
  formCard: { gap: 14, padding: 20 },
  dateRow: { flexDirection: 'row', gap: 12 },
  errorText: { color: C.danger, fontSize: 12, fontWeight: '700' },

  // CREATE MEMORY
  createMemoryStack: { gap: 14 },
  cameraBanner: { padding: 22, gap: 12, overflow: 'hidden' },
  cameraTitle: { fontSize: 24, fontWeight: '900', color: C.white },
  cameraSub: { fontSize: 13, color: C.muted },
  cameraBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  attachmentCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  attachmentIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentIcon: { fontSize: 20 },
  attachmentLabel: { fontSize: 15, fontWeight: '800', color: C.white },
  attachmentSub: { fontSize: 12, color: C.muted },

  // FLOATING DOCK (BOTTOM NAV)
  dockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  dockBlur: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: Platform.OS === 'web' ? 'rgba(11, 17, 28, 0.88)' : undefined,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dockItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    gap: 3,
  },
  dockItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dockIcon: { fontSize: 17, opacity: 0.6 },
  dockIconActive: { opacity: 1 },
  dockLabel: { fontSize: 10, fontWeight: '700', color: C.muted },
  dockLabelActive: { color: C.accent, fontWeight: '800' },
  dockCenterBtnWrap: {
    paddingHorizontal: 6,
  },
  dockCenterBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  dockCenterBtnText: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '900',
    color: '#070A11',
  },

  // TRIP SWITCHER
  switcherPill: {
    backgroundColor: 'rgba(255, 179, 64, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: 140,
  },
  switcherText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  switcherModal: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    gap: 14,
    zIndex: 2,
  },
  switcherHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  switcherTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: C.accent,
  },
  switcherClose: {
    fontSize: 18,
    color: C.muted,
    fontWeight: '700',
    padding: 4,
  },
  switcherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginVertical: 2,
  },
  switcherItemActive: {
    backgroundColor: 'rgba(255, 179, 64, 0.12)',
  },
  switcherItemDot: {
    fontSize: 10,
    color: C.accent,
  },
  switcherItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.white,
  },
  switcherItemMeta: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  switcherCheck: {
    fontSize: 16,
    fontWeight: '900',
    color: C.accent,
  },

  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
