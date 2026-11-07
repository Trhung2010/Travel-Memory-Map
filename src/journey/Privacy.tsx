import React, { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Authentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useJourney } from './JourneyContext';
import { diaryReminderDates } from './reminders';
import { GlassButton, GlassCard } from '../components/GlassUi';
import { C, GRADIENTS } from '../theme/colors';

const KEY = 'travel.lock.v1';
const LockContext = createContext({ enabled: false, locked: false, setEnabled: async (_value: boolean) => {} });
export const useDiaryLocked = () => useContext(LockContext).locked;

export function DiaryLock({ children }: PropsWithChildren) {
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState('');
  const busy = useRef(false);

  const load = () => {
    void AsyncStorage.getItem(KEY)
      .then(value => {
        if (value !== null && value !== 'true' && value !== 'false') throw new Error('Invalid lock preference');
        const active = value === 'true';
        setEnabledState(active);
        setLocked(active);
        setLoaded(true);
      })
      .catch(() => setError('Không đọc được cài đặt khóa. Thử lại.'));
  };

  useEffect(load, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (enabled && state !== 'active' && !busy.current) setLocked(true);
    });
    return () => subscription.remove();
  }, [enabled]);

  const authenticate = async () => {
    if (busy.current) return false;
    busy.current = true;
    try {
      const result = await Authentication.authenticateAsync({
        promptMessage: 'Mở nhật ký hành trình',
        cancelLabel: 'Hủy',
      });
      if (!result.success) throw new Error('Chưa xác thực. Hãy thử lại hoặc dùng mã khóa thiết bị.');
      return true;
    } finally {
      busy.current = false;
    }
  };

  const change = async (value: boolean) => {
    if (value && !(await Authentication.isEnrolledAsync()))
      throw new Error('Hãy thiết lập vân tay hoặc Face ID trong cài đặt thiết bị trước.');
    if (!(await authenticate())) return;
    await AsyncStorage.setItem(KEY, String(value));
    setEnabledState(value);
    setLocked(AppState.currentState !== 'active');
  };

  const unlock = async () => {
    setError('');
    try {
      if (await authenticate()) setLocked(AppState.currentState !== 'active');
    } catch (reason) {
      setError(String(reason instanceof Error ? reason.message : reason));
    }
  };

  if (!loaded) {
    return (
      <View style={styles.lock}>
        <LinearGradient colors={GRADIENTS.background} style={StyleSheet.absoluteFill} />
        <Text style={styles.text}>{error || 'Đang mở nhật ký…'}</Text>
        {!!error && <GlassButton title="Thử lại" variant="primary" onPress={load} />}
      </View>
    );
  }

  return (
    <LockContext.Provider value={{ enabled, locked: enabled && locked, setEnabled: change }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={enabled && locked ? 'none' : 'auto'}
        accessibilityElementsHidden={enabled && locked}
        importantForAccessibility={enabled && locked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>

      {enabled && locked && (
        <View style={styles.lock} accessibilityViewIsModal>
          <LinearGradient colors={GRADIENTS.background} style={StyleSheet.absoluteFill} />
          <GlassCard style={styles.lockCard}>
            <View style={styles.lockIconWrap}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
            <Text style={styles.lockTitle}>Nhật ký đã khóa</Text>
            <Text style={styles.lockSubtitle}>
              {error || 'Xác thực vân tay hoặc Face ID để truy cập khoảnh khắc của bạn.'}
            </Text>
            <GlassButton title="Mở khóa bằng sinh trắc học" variant="primary" onPress={() => void unlock()} />
          </GlassCard>
        </View>
      )}
    </LockContext.Provider>
  );
}

export function DeviceSettings() {
  const { enabled, setEnabled } = useContext(LockContext);
  const { activeTrip } = useJourney();
  const [time, setTime] = useState('20:00');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const run = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const cancel = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of all)
      if (item.content.data?.tripId === activeTrip?.id && item.content.data?.diary)
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
  };

  const schedule = async () => {
    if (!activeTrip) throw new Error('Chọn chuyến đi trước.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Giờ phải theo định dạng HH:mm.');
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('diary', {
        name: 'Nhắc nhật ký',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) throw new Error('Cần quyền thông báo để nhắc nhật ký.');
    const dates = diaryReminderDates(activeTrip.startDate, activeTrip.endDate, time);
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    if (existing.length + dates.length > 60)
      throw new Error('Không đủ chỗ cập nhật an toàn trong giới hạn 60 lời nhắc. Hãy tắt lịch nhắc cũ rồi đặt lại.');
    const ids: string[] = [];
    try {
      for (const date of dates)
        ids.push(
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Viết nhật ký hôm nay',
              body: 'Ghi lại một kỷ niệm trong chuyến đi.',
              data: { diary: true, tripId: activeTrip.id, start: activeTrip.startDate, end: activeTrip.endDate },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'diary' },
          })
        );
    } catch (error) {
      await Promise.allSettled(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
      throw error;
    }
    for (const item of existing)
      if (item.content.data?.tripId === activeTrip.id && item.content.data?.diary)
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
    setMessage(`Đã đặt ${dates.length} lời nhắc lúc ${time}.`);
  };

  return (
    <View style={styles.settingsSection}>
      <Text style={styles.title}>Riêng tư & Lời nhắc nhật ký</Text>
      <GlassButton
        disabled={busy}
        title={enabled ? 'Tắt khóa nhật ký' : 'Bật khóa vân tay / Face ID'}
        variant={enabled ? 'danger' : 'accent-glass'}
        icon={enabled ? '🔓' : '🔒'}
        onPress={() => void run(() => setEnabled(!enabled))}
      />

      <View style={styles.divider} />

      <Text style={styles.subtext}>Lời nhắc viết nhật ký cho: {activeTrip?.title || 'chuyến đang chọn'}</Text>
      <View style={styles.timeInputRow}>
        <Text style={styles.timeLabel}>GIỜ NHẮC:</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Giờ nhắc nhật ký"
          value={time}
          onChangeText={setTime}
          maxLength={5}
          placeholder="20:00"
          placeholderTextColor={C.dim}
        />
      </View>

      <GlassButton
        disabled={busy || !activeTrip}
        title="Đặt / cập nhật lời nhắc"
        variant="primary"
        icon="🔔"
        onPress={() => void run(schedule)}
      />
      <GlassButton
        disabled={busy || !activeTrip}
        title="Tắt lời nhắc chuyến này"
        variant="glass"
        onPress={() =>
          void run(async () => {
            await cancel();
            setMessage('Đã tắt lời nhắc.');
          })
        }
      />
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.messageText}>
          {message}
        </Text>
      )}
    </View>
  );
}

export function DiaryNotifications() {
  const { trips, ready, setActiveTripId } = useJourney();
  const router = useRouter();
  const handled = useRef(new Set<string>());
  const tripKey = trips.map(trip => `${trip.id}:${trip.startDate}:${trip.endDate}`).join('|');

  useEffect(() => {
    if (!ready) return;
    const open = (response: Notifications.NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (handled.current.has(identifier)) return;
      handled.current.add(identifier);
      const data = response.notification.request.content.data || {};
      if (
        (data.diary || data.postcard) &&
        typeof data.tripId === 'string' &&
        trips.some(trip => trip.id === data.tripId)
      ) {
        setActiveTripId(data.tripId);
        if (data.postcard) router.push({ pathname: '/postcard', params: { tripId: data.tripId } });
        else router.push({ pathname: '/journey/[scene]', params: { scene: 'edit-memory' } });
        void Notifications.clearLastNotificationResponseAsync().catch(()=>undefined);
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(response=>{if(response)open(response);}).catch(()=>undefined);
    const subscription=Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getAllScheduledNotificationsAsync().then(async items=>{
      for(const item of items){
        if(!item.content.data?.diary&&!item.content.data?.postcard)continue;
        const trip=trips.find(value=>value.id===item.content.data?.tripId);
        if(!trip||(item.content.data?.diary&&(trip.startDate!==item.content.data?.start||trip.endDate!==item.content.data?.end)))await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }).catch(()=>undefined);
    return ()=>subscription.remove();
  },[tripKey,ready,router,setActiveTripId]);
  return null;
}

const styles=StyleSheet.create({
  lock:{...StyleSheet.absoluteFill,zIndex:1000,elevation:1000,alignItems:'center',justifyContent:'center',padding:24},
  lockCard:{width:'100%',maxWidth:380,padding:28,alignItems:'center',gap:14,borderWidth:1,borderColor:C.glassBorderHighlight},
  lockIconWrap:{width:72,height:72,borderRadius:36,backgroundColor:'rgba(255,179,64,0.15)',alignItems:'center',justifyContent:'center'},
  lockIcon:{fontSize:36},
  lockTitle:{fontSize:22,fontWeight:'900',color:C.white,textAlign:'center'},
  lockSubtitle:{fontSize:13,color:C.muted,textAlign:'center',lineHeight:20},
  settingsSection:{gap:12},
  title:{fontSize:17,fontWeight:'800',color:C.white},
  subtext:{fontSize:13,color:C.muted},
  divider:{height:1,backgroundColor:C.glassBorder,marginVertical:6},
  timeInputRow:{flexDirection:'row',alignItems:'center',gap:12},
  timeLabel:{fontSize:11,fontWeight:'800',color:C.muted,letterSpacing:1.2},
  input:{flex:1,minHeight:46,color:C.white,borderWidth:1,borderColor:C.glassBorder,borderRadius:14,backgroundColor:'rgba(255,255,255,0.04)',paddingHorizontal:14,fontSize:14},
  messageText:{color:C.accent,fontSize:13,fontWeight:'700'},
  text:{color:C.muted,fontSize:14},
});
