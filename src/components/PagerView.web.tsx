import React, { Children, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { C } from '../theme/colors';

type PagerProps = ViewProps & {
  initialPage?: number;
  offscreenPageLimit?: number;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
};

export default function WebPager({
  initialPage = 0,
  offscreenPageLimit: _offscreenPageLimit,
  onPageSelected,
  children,
  ...props
}: PagerProps) {
  const pages = Children.toArray(children);
  const [page, setPage] = useState(initialPage);
  const current = Math.max(0, Math.min(page, pages.length - 1));

  const select = (position: number) => {
    setPage(position);
    onPageSelected?.({ nativeEvent: { position } });
  };

  return (
    <View {...props}>
      <View style={{ flex: 1 }}>{pages[current]}</View>
      <View style={styles.navBar}>
        {[
          ['‹ Trước', current - 1],
          [`${current + 1} / ${pages.length}`, current],
          ['Sau ›', current + 1],
        ].map(([label, targetIndex], idx) => {
          const isIndicator = idx === 1;
          const isDisabled = !isIndicator && (Number(targetIndex) < 0 || Number(targetIndex) >= pages.length);

          if (isIndicator) {
            return (
              <View key={label} style={styles.indicatorPill}>
                <Text style={styles.indicatorText}>{label}</Text>
              </View>
            );
          }

          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              disabled={isDisabled}
              onPress={() => select(Number(targetIndex))}
              style={({ pressed }) => [
                styles.navBtn,
                isDisabled && styles.navBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.navBtnText, isDisabled && { color: C.dim }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
    borderRadius: 20,
    marginTop: 8,
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  navBtnDisabled: {
    opacity: 0.35,
    backgroundColor: 'transparent',
  },
  navBtnText: {
    color: C.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  indicatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  indicatorText: {
    color: C.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
  },
});
