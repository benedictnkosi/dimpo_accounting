import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { brand } from '@/constants/matric';
import {
  FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT,
  FREE_PRACTICE_DAILY_LIMIT,
  FreeLimitType,
  getDailyAllowanceResetLabel,
} from '@/services/accessPolicy';

interface FreeLimitModalProps {
  visible: boolean;
  limitType: FreeLimitType;
  usedToday: number;
  onUpgrade: () => void;
  onDismiss: () => void;
}

export function FreeLimitModal({
  visible,
  limitType,
  usedToday,
  onUpgrade,
  onDismiss,
}: FreeLimitModalProps) {
  const limit =
    limitType === 'accounting_level2'
      ? FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT
      : FREE_PRACTICE_DAILY_LIMIT;
  const title =
    limitType === 'accounting_level2'
      ? 'Core Practice lifetime limit reached'
      : 'Daily practice limit reached';
  const body =
    limitType === 'accounting_level2'
      ? `Free learners can complete up to ${limit} Level 2 questions in total. Upgrade to Pro for unlimited Level 2, all of Levels 3–4, and full explanations.`
      : `Free learners can complete ${limit} step-by-step practice questions each local day. Upgrade to Pro for unlimited practice and worked explanations.`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="summary">
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={28} color={brand.amber} />
          </View>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.body}>{body}</ThemedText>
          <ThemedText style={styles.meta}>
            Progress today: {Math.min(usedToday, limit)} of {limit} completed
          </ThemedText>
          {limitType === 'practice' ? (
            <ThemedText style={styles.meta}>Resets {getDailyAllowanceResetLabel()}</ThemedText>
          ) : null}

          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro"
          >
            <ThemedText style={styles.primaryButtonText}>Upgrade to Pro</ThemedText>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <ThemedText style={styles.secondaryButtonText}>Not now</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
    padding: 22,
    gap: 10,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    marginBottom: 4,
  },
  title: {
    color: brand.text,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: brand.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: brand.primary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: brand.primarySoft,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
});
