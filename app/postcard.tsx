import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from '../src/components/MapView';
import { AudioCard } from '../src/journey/JourneyFeatures';
import { useJourney } from '../src/journey/JourneyContext';
import { GlassButton, GlassCard, GlassHeader } from '../src/components/GlassUi';
import { C, GRADIENTS } from '../src/theme/colors';

export default function Postcard() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, memories } = useJourney();
  const router = useRouter();

  const trip = trips.find(t => t.id === tripId);
  const rows = memories.filter(m => m.tripId === tripId);
  const pictures = rows.filter(m => m.kind === 'photo' && m.uri).slice(0, 3);
  const recording = rows.find(m => m.kind === 'audio' && m.uri);
  const pin = rows.find(m => m.latitude !== undefined && m.longitude !== undefined);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENTS.background} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <GlassHeader
          title={trip ? `Bưu thiếp ${trip.destination}` : 'Bưu thiếp'}
          eyebrow="GỬI ĐẾN MAI SAU"
          back={goBack}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {trip ? (
            <GlassCard elevated highlight style={styles.postcardFrame}>
              {/* POSTAL STAMP BADGE */}
              <View style={styles.postmarkRow}>
                <View style={styles.stampBadge}>
                  <Text style={styles.stampIcon}>📮</Text>
                  <View>
                    <Text style={styles.stampText}>TRAVEL MEMORY</Text>
                    <Text style={styles.stampDate}>AIR MAIL</Text>
                  </View>
                </View>
                <View style={styles.destTag}>
                  <Text style={styles.destTagText}>📍 {trip.destination.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.postcardTitle}>Bưu thiếp từ {trip.destination}</Text>
              <Text style={styles.tripMeta}>
                {trip.title} · {trip.startDate} – {trip.endDate}
              </Text>

              {/* PHOTOS */}
              {pictures.length > 0 && (
                <View style={styles.photoGrid}>
                  {pictures.map(p => (
                    <Image
                      key={p.id}
                      accessibilityLabel={p.title}
                      source={{ uri: p.uri }}
                      style={styles.photo}
                    />
                  ))}
                </View>
              )}

              {/* MAP PIN */}
              {pin && (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: pin.latitude!,
                      longitude: pin.longitude!,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                  >
                    <Marker coordinate={{ latitude: pin.latitude!, longitude: pin.longitude! }} title={pin.title} />
                  </MapView>
                </View>
              )}

              {/* DESCRIPTION / MESSAGE */}
              {!!trip.description && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>"{trip.description}"</Text>
                </View>
              )}

              {/* RECORDING */}
              {recording?.uri && (
                <View style={styles.audioWrap}>
                  <AudioCard uri={recording.uri} />
                </View>
              )}
            </GlassCard>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📪</Text>
              <Text style={styles.emptyTitle}>Chuyến đi này không còn tồn tại</Text>
              <Text style={styles.emptySubtitle}>Bưu thiếp không tìm thấy dữ liệu hành trình tương ứng.</Text>
            </GlassCard>
          )}

          <GlassButton
            title="Quay về trang chủ"
            variant="glass"
            icon="🏠"
            onPress={goBack}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  content: {
    padding: 18,
    gap: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 40,
  },
  postcardFrame: {
    padding: 22,
    gap: 16,
    borderRadius: 24,
  },
  postmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 64, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 179, 64, 0.08)',
  },
  stampIcon: { fontSize: 20 },
  stampText: { fontSize: 9, fontWeight: '900', color: C.accent, letterSpacing: 1.2 },
  stampDate: { fontSize: 8, color: C.muted, fontWeight: '700' },
  destTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  destTagText: { fontSize: 11, fontWeight: '800', color: C.text },
  postcardTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: C.white,
    letterSpacing: -0.5,
  },
  tripMeta: { fontSize: 13, color: C.muted, fontWeight: '600' },
  photoGrid: { gap: 12 },
  photo: { height: 220, width: '100%', borderRadius: 16, backgroundColor: '#090D15' },
  mapContainer: { height: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder },
  map: { ...StyleSheet.absoluteFill },
  messageBox: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
    color: C.text,
    fontStyle: 'italic',
  },
  audioWrap: { marginTop: 4 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  emptySubtitle: { fontSize: 13, color: C.muted, textAlign: 'center' },
});
