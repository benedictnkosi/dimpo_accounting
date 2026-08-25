import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { SaFlagMark } from '@/components/home/SaFlagMark';
import { brand } from '@/constants/matric';

interface HomeHeaderProps {
  firstName?: string | null;
  streakCount?: number;
}

export function HomeHeader(_props: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <SaFlagMark size={36} />
        <ThemedText style={styles.wordmark}>Accounting CPA QUIZ</ThemedText>
      </View>
    </View>
  );
}

interface HomeFooterProps {
  onProfile: () => void;
  onShare: () => void;
  shareLabel?: string;
}

export function HomeFooter({ onProfile, onShare, shareLabel = 'Share' }: HomeFooterProps) {
  return (
    <View style={styles.footerWrap}>
      <View style={styles.footerRow}>
        <Pressable
          onPress={onProfile}
          style={({ pressed }) => [styles.profilePill, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <Ionicons name="person-outline" size={18} color={brand.text} />
          <ThemedText style={styles.profileText}>Profile</ThemedText>
        </Pressable>
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={shareLabel}
        >
          <Ionicons name="share-outline" size={18} color={brand.textSecondary} />
          <ThemedText style={styles.shareText}>{shareLabel}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wordmark: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
    color: brand.primarySoft,
    letterSpacing: -0.4,
  },
  footerWrap: {
    borderTopWidth: 1,
    borderTopColor: brand.border,
    backgroundColor: brand.background,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.28)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  profileText: {
    color: brand.text,
    fontSize: 15,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  shareText: {
    color: brand.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
