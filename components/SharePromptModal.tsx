import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { brand, SHARE_MESSAGE, SHARE_PROMPT_EVERY, SHARE_URL } from '@/constants/matric';
import { logAnalyticsEvent } from '@/services/analytics';
import { shareContent } from '@/utils/share';

interface SharePromptModalProps {
  visible: boolean;
  source: 'lesson' | 'practice';
  onClose: () => void;
}

export function SharePromptModal({ visible, source, onClose }: SharePromptModalProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    logAnalyticsEvent('share_prompt_share', { source, interval: SHARE_PROMPT_EVERY });
    const result = await shareContent({
      message: `${SHARE_MESSAGE}\n${SHARE_URL}`,
      url: SHARE_URL,
      title: 'Accounting CPA QUIZ',
    });
    setIsSharing(false);
    if (result.ok) {
      logAnalyticsEvent('share', {
        method: result.method || 'native',
        content_type: 'share_prompt',
        source,
      });
      onClose();
    }
  };

  const handleDismiss = () => {
    if (isSharing) return;
    logAnalyticsEvent('share_prompt_dismiss', { source, interval: SHARE_PROMPT_EVERY });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="share-outline" size={28} color={brand.primarySoft} />
          </View>
          <ThemedText style={styles.eyebrow}>SHARE THE APP</ThemedText>
          <ThemedText style={styles.title}>{SHARE_PROMPT_EVERY} questions down</ThemedText>
          <ThemedText style={styles.body}>
            Help a classmate prep for Accounting. Share Accounting CPA QUIZ — step-by-step study
            instead of scrolling.
          </ThemedText>

          <Pressable
            onPress={handleShare}
            disabled={isSharing}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && !isSharing && styles.pressed,
              isSharing && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Share Accounting CPA QUIZ"
          >
            <Ionicons name="share-outline" size={18} color={brand.background} />
            <ThemedText style={styles.shareButtonText}>
              {isSharing ? 'Opening…' : 'Share'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            disabled={isSharing}
            style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <ThemedText style={styles.laterText}>Not now</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: brand.cardElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 22,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(45, 212, 191, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    color: brand.primarySoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: brand.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
    textAlign: 'center',
  },
  shareButton: {
    width: '100%',
    backgroundColor: brand.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  shareButtonText: {
    color: brand.background,
    fontSize: 17,
    fontWeight: '700',
  },
  laterButton: {
    marginTop: 14,
    padding: 8,
  },
  laterText: {
    color: brand.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.7,
  },
});
