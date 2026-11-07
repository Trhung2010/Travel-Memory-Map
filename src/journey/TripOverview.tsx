import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useJourney } from './JourneyContext';
import { TripExtras } from './Extras';
import { GlassButton, GlassCard } from '../components/GlassUi';
import { C, GRADIENTS } from '../theme/colors';
import type { JourneyScene } from './scenes';

export default function TripOverview({
  go,
}: {
  go: (scene: JourneyScene, params?: Record<string, string>) => void;
}) {
  const { activeTrip: trip, memories } = useJourney();
  const [more, setMore] = useState(false);

  const rows = useMemo(
    () => (trip ? memories.filter(m => m.tripId === trip.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [memories, trip]
  );

  if (!trip) return null;

  const cover = trip.coverUri || rows.find(m => m.kind === 'photo' && m.uri)?.uri;
  const locatedCount = rows.filter(m => m.latitude !== undefined).length;
  const dayCount = new Set(rows.map(m => m.createdAt.slice(0, 10))).size || 1;

  return (
    <View style={s.stack}>
      {/* HERO BANNER WITH COVER */}
      <View style={s.hero}>
        {cover ? (
          <Image accessibilityLabel={`Ảnh chuyến đi ${trip.title}`} source={{ uri: cover }} style={s.cover} />
        ) : (
          <LinearGradient
            colors={GRADIENTS.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.cover, s.placeholderCover]}
          >
            <Text style={s.coverPlaceholderIcon}>🗺️</Text>
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(7, 10, 17, 0.7)', C.bg]}
          style={s.heroGradient}
        />
        <View style={s.intro}>
          <View style={s.destinationPill}>
            <Text style={s.destinationDot}>📍</Text>
            <Text style={s.caption}>{trip.destination.toUpperCase()}</Text>
          </View>
          <Text style={s.heading}>{trip.title}</Text>
          <Text style={s.dateSubtitle}>
            {trip.startDate} — {trip.endDate}
          </Text>
          {!!trip.description && <Text style={s.body}>{trip.description}</Text>}

          <View style={s.actions}>
            <GlassButton
              title="＋ Thêm kỷ niệm"
              variant="primary"
              onPress={() => go('create-memory')}
              style={{ flex: 1 }}
            />
            <GlassButton
              title="Chỉnh sửa"
              variant="glass"
              onPress={() => go('edit-trip')}
            />
          </View>
        </View>
      </View>

      {/* METRIC KPI COUNTERS */}
      <View style={s.statsRow}>
        <GlassCard style={s.statCard}>
          <Text style={s.statNumber}>{rows.length}</Text>
          <Text style={s.statLabel}>KỶ NIỆM</Text>
        </GlassCard>
        <GlassCard style={s.statCard}>
          <Text style={s.statNumber}>{locatedCount}</Text>
          <Text style={s.statLabel}>ĐỊA ĐIỂM</Text>
        </GlassCard>
        <GlassCard style={s.statCard}>
          <Text style={s.statNumber}>{dayCount}</Text>
          <Text style={s.statLabel}>SỐ NGÀY</Text>
        </GlassCard>
      </View>

      {/* QUICK SHORTCUTS */}
      <View style={s.quickGrid}>
        {(
          [
            ['trip-map', 'Bản đồ', '📍'],
            ['timeline', 'Timeline', '⏱️'],
            ['gallery', 'Thư viện', '🖼️'],
            ['story', 'Story', '✨'],
          ] as const
        ).map(([scene, label, icon]) => (
          <Pressable
            key={scene}
            accessibilityRole="button"
            style={({ pressed }) => [s.shortcutCard, pressed && s.pressed]}
            onPress={() => go(scene)}
          >
            <Text style={s.shortcutIcon}>{icon}</Text>
            <Text style={s.shortcutLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* RECENT MEMORIES */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>KỶ NIỆM GẦN ĐÂY</Text>
          <Pressable accessibilityRole="button" onPress={() => go('timeline')}>
            <Text style={s.link}>Xem tất cả ›</Text>
          </Pressable>
        </View>

        {rows.length ? (
          <View style={s.grid}>
            {rows.slice(0, 4).map(m => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`Xem ${m.title}`}
                style={({ pressed }) => [s.memory, pressed && s.pressed]}
                onPress={() => go('memory-detail', { id: m.id })}
              >
                {m.kind === 'photo' && m.uri ? (
                  <Image source={{ uri: m.uri }} style={s.photo} />
                ) : (
                  <View style={[s.photo, s.placeholder]}>
                    <Text style={s.placeholderIcon}>
                      {{
                        video: '▶ Video',
                        audio: '🎙️ Ghi âm',
                        note: '📝 Ghi chú',
                        document: '📄 Tài liệu',
                        photo: '🖼️ Ảnh',
                      }[m.kind]}
                    </Text>
                  </View>
                )}
                <View style={s.memoryText}>
                  <Text numberOfLines={1} style={s.memoryTitle}>
                    {m.title}
                  </Text>
                  <Text style={s.memoryDate}>
                    {new Date(m.createdAt).toLocaleDateString('vi-VN')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <GlassCard style={s.empty}>
            <Text style={s.emptyIcon}>📷</Text>
            <Text style={s.emptyTitle}>Chuyến đi chưa có kỷ niệm</Text>
            <Text style={s.emptySubtitle}>Hãy ghi lại khoảnh khắc hoặc tải ảnh lên để bắt đầu.</Text>
            <GlassButton
              title="Chọn ảnh từ máy"
              variant="accent-glass"
              onPress={() => go('media-picker')}
            />
          </GlassCard>
        )}
      </View>

      {/* ITINERARY & DISCOVERY UTILITIES */}
      <GlassCard style={s.moreCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: more }}
          style={s.moreToggle}
          onPress={() => setMore(!more)}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.moreTitle}>Lịch trình & Khám phá</Text>
            <Text style={s.moreSubtitle}>Kế hoạch ngày, đổi ảnh bìa, bưu thiếp và ghi chú ẩn.</Text>
          </View>
          <View style={s.moreIconWrap}>
            <Text style={s.moreIcon}>{more ? '▲' : '▼'}</Text>
          </View>
        </Pressable>
        {more && (
          <View style={s.moreContent}>
            <TripExtras key={trip.id} />
          </View>
        )}
      </GlassCard>
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 20 },
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.glassBorder,
    minHeight: 280,
    justifyContent: 'flex-end',
  },
  cover: { width: '100%', height: 280, position: 'absolute', top: 0, left: 0 },
  placeholderCover: { alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderIcon: { fontSize: 64, opacity: 0.3 },
  heroGradient: { ...StyleSheet.absoluteFill },
  intro: { padding: 20, gap: 10 },
  destinationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 179, 64, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.3)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  destinationDot: { fontSize: 11 },
  caption: { color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heading: { color: C.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  dateSubtitle: { color: C.muted, fontSize: 13, fontWeight: '600' },
  body: { color: C.text, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  statNumber: { fontSize: 22, fontWeight: '900', color: C.white },
  statLabel: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1.2 },

  quickGrid: { flexDirection: 'row', gap: 10 },
  shortcutCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shortcutIcon: { fontSize: 22 },
  shortcutLabel: { fontSize: 12, fontWeight: '700', color: C.text },

  section: { gap: 12 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: C.muted },
  link: { fontSize: 13, color: C.accent, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  memory: {
    width: '48%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.glassCard,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  photo: { height: 130, width: '100%', backgroundColor: '#090D15' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { color: C.muted, fontSize: 13, fontWeight: '700' },
  memoryText: { padding: 12, gap: 4 },
  memoryTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  memoryDate: { color: C.dim, fontSize: 11, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { color: C.white, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { color: C.muted, fontSize: 13, textAlign: 'center' },

  moreCard: { padding: 16 },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moreTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  moreSubtitle: { color: C.muted, fontSize: 12 },
  moreIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: { color: C.accent, fontSize: 10 },
  moreContent: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: C.glassBorder },

  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
