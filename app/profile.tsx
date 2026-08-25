import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { brand } from '@/constants/matric';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import {
  AppleSignInCancelledError,
  GoogleSignInCancelledError,
  appleLogin,
  googleLogin,
  googleSignOut,
  isAppleAuthAvailable,
  isAppleSignInCancelled,
  isGoogleAuthAvailable,
  isGoogleSignInCancelled,
} from '@/services/authService';
import { ensureUserProfile, syncProgressFromCloud } from '@/services/progress';
import { logAnalyticsEvent } from '@/services/analytics';

type SyncState = 'idle' | 'syncing' | 'synced';

function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <ThemedText style={styles.googleG}>G</ThemedText>
    </View>
  );
}

function AppleSignInButton({
  onPress,
  disabled,
  useNative,
  loading,
}: {
  onPress: () => void;
  disabled?: boolean;
  useNative?: boolean;
  loading?: boolean;
}) {
  const apple = useMemo(() => {
    if (!useNative) return null;
    try {
      // Native button is missing until an iOS rebuild — require must be guarded.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    } catch {
      return null;
    }
  }, [useNative]);

  if (apple?.AppleAuthenticationButton && !loading) {
    const NativeButton = apple.AppleAuthenticationButton;
    return (
      <View
        style={[styles.appleButtonWrap, disabled && styles.disabled]}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        <NativeButton
          buttonType={apple.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={apple.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={16}
          style={styles.appleButton}
          onPress={onPress}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.appleFallbackButton,
        (pressed || disabled) && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Apple"
    >
      {loading ? (
        <ActivityIndicator color="#000000" />
      ) : (
        <Ionicons name="logo-apple" size={22} color="#000000" />
      )}
      <ThemedText style={styles.appleFallbackText}>
        {loading ? 'Signing in…' : 'Sign in with Apple'}
      </ThemedText>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading, signOut, refreshUser } = useAuth();
  const { isPremium } = useRevenueCat();
  const [signingInWith, setSigningInWith] = useState<'google' | 'apple' | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const [nativeAppleReady, setNativeAppleReady] = useState(false);
  const googleAvailable = useMemo(() => isGoogleAuthAvailable(), []);
  const authAvailable = googleAvailable || appleAvailable;
  const isSigningIn = signingInWith !== null;

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setAppleAvailable(false);
      return;
    }
    setAppleAvailable(true);
    let cancelled = false;
    isAppleAuthAvailable().then((available) => {
      if (!cancelled) setNativeAppleReady(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setSyncState('idle');
      return;
    }

    let cancelled = false;

    async function syncAfterAuth() {
      setSyncState('syncing');
      try {
        await ensureUserProfile({
          uid: user!.uid,
          email: user!.email,
          name: user!.displayName,
          photoURL: user!.photoURL,
        });
        await syncProgressFromCloud(user!.uid);
        if (!cancelled) setSyncState('synced');
      } catch (error) {
        console.error('Failed to sync profile progress:', error);
        if (!cancelled) setSyncState('synced');
      }
    }

    syncAfterAuth();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email, user?.displayName, user?.photoURL]);

  const handleGoogleLogin = useCallback(async () => {
    if (isSigningIn || !googleAvailable) return;
    setSignInError(null);
    setSigningInWith('google');
    try {
      await googleLogin();
      logAnalyticsEvent('login', { method: 'google' });
    } catch (error) {
      if (isGoogleSignInCancelled(error) || error instanceof GoogleSignInCancelledError) {
        return;
      }
      console.error('Google sign-in failed:', error);
      setSignInError('Could not sign in. Please try again.');
    } finally {
      setSigningInWith(null);
    }
  }, [googleAvailable, isSigningIn]);

  const handleAppleLogin = useCallback(async () => {
    if (isSigningIn || !appleAvailable) return;
    setSignInError(null);
    setSigningInWith('apple');
    try {
      await appleLogin();
      await refreshUser();
      logAnalyticsEvent('login', { method: 'apple' });
    } catch (error) {
      if (isAppleSignInCancelled(error) || error instanceof AppleSignInCancelledError) {
        return;
      }
      console.error('Apple sign-in failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (
        message.includes('APPLE_SIGN_IN_REBUILD_REQUIRED') ||
        message.includes('UnavailabilityError') ||
        message.includes('not available')
      ) {
        setSignInError(
          'Sign in with Apple needs a native iOS rebuild. Run npx expo run:ios (or a new EAS build).'
        );
        return;
      }
      if (code === 'auth/operation-not-allowed') {
        setSignInError(
          'Apple Sign-In is not enabled in Firebase. Enable the Apple provider in the Firebase console.'
        );
        return;
      }
      if (code === 'auth/invalid-credential' || code === 'auth/invalid-custom-token') {
        setSignInError(
          message.includes('OAuth') || message.includes('apple.com')
            ? `Apple sign-in failed: ${message}`
            : `Apple credential rejected by Firebase (${code}). ${message}`
        );
        return;
      }
      setSignInError(
        code
          ? `Could not sign in with Apple (${code}). ${message}`
          : 'Could not sign in with Apple. Please try again.'
      );
    } finally {
      setSigningInWith(null);
    }
  }, [appleAvailable, isSigningIn, refreshUser]);

  const handleLogout = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignInError(null);
    try {
      logAnalyticsEvent('sign_out');
      await googleSignOut();
      await signOut();
      setSyncState('idle');
    } catch (error) {
      console.error('Sign out failed:', error);
      setSignInError('Could not sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  const initial = useMemo(() => {
    const source = user?.displayName?.trim() || user?.email?.trim() || 'S';
    return source.charAt(0).toUpperCase();
  }, [user?.displayName, user?.email]);

  const callout = useMemo(() => {
    if (isLoading) return null;
    if (!user) {
      return {
        tone: 'sky' as const,
        icon: 'cloud-outline' as const,
        title: 'Save progress to the cloud',
        body: 'Your scores are saved on this device only. Sign in to back up your progress to the cloud and pick up where you left off on any device.',
      };
    }
    if (syncState === 'syncing') {
      return {
        tone: 'emerald' as const,
        icon: 'sync-outline' as const,
        title: 'Syncing progress…',
        body: 'Merging your quiz scores with your cloud account.',
      };
    }
    return {
      tone: 'emerald' as const,
      icon: 'checkmark-circle-outline' as const,
      title: 'Progress backed up to the cloud',
      body: "You're signed in. Your quiz scores and stats sync to your account and follow you across devices.",
    };
  }, [isLoading, syncState, user]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerWrap}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.headerRow}>
          <Pressable
            onPress={goHome}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={brand.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.eyebrow}>Account</ThemedText>
            <ThemedText style={styles.title}>Profile</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {callout && (
          <View
            style={[
              styles.callout,
              callout.tone === 'sky' ? styles.calloutSky : styles.calloutEmerald,
            ]}
          >
            <View
              style={[
                styles.calloutIcon,
                callout.tone === 'sky' ? styles.calloutIconSky : styles.calloutIconEmerald,
              ]}
            >
              <Ionicons
                name={callout.icon}
                size={22}
                color={callout.tone === 'sky' ? brand.sky : brand.emerald}
              />
            </View>
            <View style={styles.calloutText}>
              <ThemedText style={styles.calloutTitle}>{callout.title}</ThemedText>
              <ThemedText style={styles.calloutBody}>{callout.body}</ThemedText>
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingBox} accessibilityLabel="Loading account">
            <ActivityIndicator color={brand.primary} size="large" />
          </View>
        ) : user ? (
          <View style={styles.accountCard}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <ThemedText style={styles.avatarInitial}>{initial}</ThemedText>
              </View>
            )}
            <View style={styles.accountCopy}>
              <View style={styles.accountNameRow}>
                <ThemedText style={styles.accountName} numberOfLines={1}>
                  {user.displayName?.trim() || 'Signed in'}
                </ThemedText>
                {isPremium && (
                  <View style={styles.proBadge} accessibilityLabel="Pro member">
                    <ThemedText style={styles.proBadgeText}>Pro</ThemedText>
                  </View>
                )}
              </View>
              {!!user.email && (
                <ThemedText style={styles.accountEmail} numberOfLines={1}>
                  {user.email}
                </ThemedText>
              )}
            </View>
            <Pressable
              onPress={handleLogout}
              disabled={isSigningOut}
              style={({ pressed }) => [
                styles.logoutButton,
                (pressed || isSigningOut) && styles.pressed,
                isSigningOut && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <Ionicons name="log-out-outline" size={18} color={brand.text} />
              <ThemedText style={styles.logoutText}>
                {isSigningOut ? 'Signing out…' : 'Log out'}
              </ThemedText>
            </Pressable>
          </View>
        ) : authAvailable ? (
          <View style={styles.signInBlock}>
            {appleAvailable && (
              <AppleSignInButton
                onPress={handleAppleLogin}
                disabled={isSigningIn}
                useNative={nativeAppleReady}
                loading={signingInWith === 'apple'}
              />
            )}
            {googleAvailable && (
              <Pressable
                onPress={handleGoogleLogin}
                disabled={isSigningIn}
                style={({ pressed }) => [
                  styles.googleButton,
                  (pressed || signingInWith === 'google') && styles.pressed,
                  isSigningIn && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Log in with Google"
              >
                <GoogleMark />
                <ThemedText style={styles.googleButtonText}>
                  {signingInWith === 'google' ? 'Signing in…' : 'Log in with Google'}
                </ThemedText>
              </Pressable>
            )}
            {!!signInError && (
              <ThemedText style={styles.errorText}>{signInError}</ThemedText>
            )}
          </View>
        ) : (
          <View style={styles.unavailableCard}>
            <ThemedText style={styles.unavailableText}>
              Sign-in is unavailable right now. Please try again later.
            </ThemedText>
          </View>
        )}

        <Pressable
          onPress={goHome}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel="Back to home"
        >
          <ThemedText style={styles.backLinkText}>Back to home</ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brand.background,
  },
  headerWrap: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.frosted,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 31, 48, 0.7)',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: brand.primarySoft,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  title: {
    color: brand.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  callout: {
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  calloutSky: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  calloutEmerald: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  calloutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutIconSky: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  calloutIconEmerald: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  calloutText: {
    flex: 1,
    gap: 6,
  },
  calloutTitle: {
    color: brand.text,
    fontSize: 17,
    fontWeight: '700',
  },
  calloutBody: {
    color: brand.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  accountCard: {
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
    borderRadius: 18,
    padding: 18,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
  },
  avatarInitial: {
    color: brand.primarySoft,
    fontSize: 26,
    fontWeight: '800',
  },
  accountCopy: {
    gap: 4,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountName: {
    flexShrink: 1,
    color: brand.text,
    fontSize: 20,
    fontWeight: '700',
  },
  proBadge: {
    backgroundColor: brand.amber,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    color: '#0B1220',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  accountEmail: {
    color: brand.textSecondary,
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.28)',
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: brand.cardElevated,
  },
  logoutText: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '600',
  },
  signInBlock: {
    gap: 12,
  },
  appleButtonWrap: {
    width: '100%',
  },
  appleButton: {
    width: '100%',
    height: 52,
  },
  appleFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  appleFallbackText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: brand.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  googleMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '800',
  },
  googleButtonText: {
    color: '#0B1220',
    fontSize: 17,
    fontWeight: '700',
  },
  errorText: {
    color: brand.rose,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  unavailableCard: {
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
    borderRadius: 16,
    padding: 18,
  },
  unavailableText: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 28,
    paddingVertical: 8,
  },
  backLinkText: {
    color: brand.primarySoft,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.7,
  },
});
