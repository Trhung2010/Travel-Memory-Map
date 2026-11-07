import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS } from '../theme/colors';

// --- GLASS CARD ---
export function GlassCard({
  children,
  style,
  elevated = false,
  highlight = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.cardElevated,
        highlight && styles.cardHighlight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// --- GLASS BUTTON ---
export function GlassButton({
  title,
  onPress,
  variant = 'glass',
  disabled = false,
  icon,
  style,
  textStyle,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'glass' | 'accent-glass' | 'danger';
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.btnPrimaryWrap,
          disabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={GRADIENTS.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnPrimaryGrad}
        >
          {!!icon && <Text style={styles.btnPrimaryIcon}>{icon}</Text>}
          <Text style={[styles.btnPrimaryText, textStyle]}>{title}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  const isDanger = variant === 'danger';
  const isAccentGlass = variant === 'accent-glass';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnGlass,
        isAccentGlass && styles.btnAccentGlass,
        isDanger && styles.btnDanger,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {!!icon && (
        <Text
          style={[
            styles.btnGlassIcon,
            isAccentGlass && { color: C.accent },
            isDanger && { color: C.danger },
          ]}
        >
          {icon}
        </Text>
      )}
      <Text
        style={[
          styles.btnGlassText,
          isAccentGlass && { color: C.accent },
          isDanger && { color: C.danger },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// --- GLASS HEADER ---
export function GlassHeader({
  title,
  eyebrow,
  back,
  home,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  back?: () => void;
  home?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.headerContainer}>
      <BlurView intensity={Platform.OS === 'ios' ? 45 : 30} tint="dark" style={styles.headerBlur}>
        <View style={styles.headerInner}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={back ? 'Quay lại' : 'Trang chủ'}
            onPress={back}
            disabled={!back}
            style={({ pressed }) => [
              styles.backButton,
              !back && { opacity: 0.6 },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backIcon}>{back ? '‹' : '✦'}</Text>
          </Pressable>

          <View style={styles.headerTitleWrap}>
            {!!eyebrow && <Text style={styles.headerEyebrow}>{eyebrow.toUpperCase()}</Text>}
            <Text numberOfLines={1} style={styles.headerTitle}>
              {title}
            </Text>
          </View>

          <View style={styles.headerTrailing}>
            {trailing || (
              home ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Về trang chủ"
                  onPress={home}
                  style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}
                >
                  <Text style={styles.homeIcon}>🏠</Text>
                </Pressable>
              ) : (
                <View style={styles.appPill}>
                  <Text style={styles.appPillDot}>●</Text>
                  <Text style={styles.appPillText}>MEMORY MAP</Text>
                </View>
              )
            )}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

// --- IMAGE VIEWER MODAL (LIGHTBOX) ---
export function ImageViewerModal({
  uri,
  title,
  date,
  onClose,
}: {
  uri: string | null;
  title?: string;
  date?: string;
  onClose: () => void;
}) {
  if (!uri) return null;

  return (
    <View style={styles.lightboxOverlay} accessibilityViewIsModal>
      <Pressable style={styles.lightboxBackdrop} onPress={onClose} />
      <View style={styles.lightboxHeader}>
        <View style={{ flex: 1 }}>
          {!!title && <Text numberOfLines={1} style={styles.lightboxTitle}>{title}</Text>}
          {!!date && <Text style={styles.lightboxDate}>{date}</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng ảnh"
          style={styles.lightboxCloseBtn}
          onPress={onClose}
        >
          <Text style={styles.lightboxCloseText}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.lightboxImageWrap}>
        <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
      </View>
    </View>
  );
}

// --- GLASS PILL / BADGE ---
export function GlassPill({
  title,
  active = false,
  onPress,
  icon,
  count,
}: {
  title: string;
  active?: boolean;
  onPress?: () => void;
  icon?: string;
  count?: number;
}) {
  const content = (
    <View style={[styles.pill, active && styles.pillActive]}>
      {!!icon && <Text style={[styles.pillIcon, active && styles.pillIconActive]}>{icon}</Text>}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{title}</Text>
      {count !== undefined && (
        <View style={[styles.pillBadge, active && styles.pillBadgeActive]}>
          <Text style={[styles.pillBadgeText, active && styles.pillBadgeTextActive]}>{count}</Text>
        </View>
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

// --- STATUS BADGE ---
export function StatusBadge({ status }: { status: 'active' | 'upcoming' | 'completed' }) {
  const cfg = {
    active: { label: 'ĐANG ĐI', dot: C.green, bg: 'rgba(48, 209, 88, 0.15)', border: 'rgba(48, 209, 88, 0.3)' },
    upcoming: { label: 'SẮP TỚI', dot: C.cyan, bg: 'rgba(100, 210, 255, 0.15)', border: 'rgba(100, 210, 255, 0.3)' },
    completed: { label: 'ĐÃ XONG', dot: C.muted, bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' },
  }[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[styles.statusDot, { color: cfg.dot }]}>●</Text>
      <Text style={[styles.statusLabel, { color: cfg.dot }]}>{cfg.label}</Text>
    </View>
  );
}

// --- GLASS INPUT ---
export function GlassInput({
  label,
  multiline = false,
  style,
  ...props
}: TextInputProps & { label?: string; multiline?: boolean }) {
  return (
    <View style={styles.inputWrap}>
      {!!label && <Text style={styles.inputLabel}>{label.toUpperCase()}</Text>}
      <TextInput
        placeholderTextColor={C.dim}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: C.glassCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: 18,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardElevated: {
    backgroundColor: C.glassElevated,
    borderColor: C.glassBorderHighlight,
  },
  cardHighlight: {
    borderColor: C.glassBorderAccent,
    backgroundColor: 'rgba(25, 36, 56, 0.8)',
  },

  // Buttons
  btnPrimaryWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  btnPrimaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    minHeight: 52,
  },
  btnPrimaryIcon: {
    fontSize: 16,
    color: '#070A11',
    fontWeight: '900',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#070A11',
    letterSpacing: 0.3,
  },
  btnGlass: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },
  btnAccentGlass: {
    backgroundColor: 'rgba(255, 179, 64, 0.12)',
    borderColor: 'rgba(255, 179, 64, 0.3)',
  },
  btnDanger: {
    backgroundColor: C.dangerGlass,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  btnGlassIcon: {
    fontSize: 15,
    color: C.text,
  },
  btnGlassText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },

  // Header
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: Platform.OS === 'web' ? 'rgba(7, 10, 17, 0.92)' : 'transparent',
  },
  headerBlur: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 26,
    lineHeight: 28,
    color: C.accent,
    fontWeight: '600',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: C.accent,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  headerTrailing: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  appPillDot: {
    fontSize: 8,
    color: C.accent,
  },
  appPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 1.2,
  },

  // Pill
  pill: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillActive: {
    backgroundColor: 'rgba(255, 179, 64, 0.16)',
    borderColor: C.accent,
  },
  pillIcon: {
    fontSize: 13,
    color: C.muted,
  },
  pillIconActive: {
    color: C.accent,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
  pillTextActive: {
    color: C.accent,
    fontWeight: '700',
  },
  pillBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillBadgeActive: {
    backgroundColor: C.accent,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  pillBadgeTextActive: {
    color: '#070A11',
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusDot: {
    fontSize: 8,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Input
  inputWrap: {
    gap: 6,
    width: '100%',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: C.muted,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    color: C.text,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 14,
  },

  // Home Button
  homeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIcon: {
    fontSize: 16,
  },

  // Lightbox
  lightboxOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(5, 8, 14, 0.96)',
    justifyContent: 'space-between',
  },
  lightboxBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 16,
    zIndex: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  lightboxTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.white,
  },
  lightboxDate: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  lightboxCloseText: {
    fontSize: 18,
    color: C.white,
    fontWeight: '700',
  },
  lightboxImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
});

