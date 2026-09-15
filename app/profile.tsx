import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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
  emailLogin,
  emailRegister,
  getEmailAuthErrorMessage,
  googleLogin,
  googleSignOut,
  isAppleAuthAvailable,
  isAppleSignInCancelled,
  isEmailAuthAvailable,
  isGoogleAuthAvailable,
  isGoogleSignInCancelled,
} from '@/services/authService';
import { ensureUserProfile, getWeakTopicInsights, loadLocalProgress, syncProgressFromCloud, type WeakTopicInsight } from '@/services/progress';
import { logAnalyticsEvent } from '@/services/analytics';
import {
  FREE_PRACTICE_DAILY_LIMIT,
} from '@/services/accessPolicy';
import { REVENUECAT_PRODUCT_IDS } from '@/services/revenueCat';

type AuthMode = 'signin' | 'register';
type SigningInWith = 'google' | 'apple' | 'email' | null;
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
  const { isPremium, presentPaywall, restorePurchases, manageSubscription, offerings } =
    useRevenueCat();
  const [signingInWith, setSigningInWith] = useState<SigningInWith>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const [nativeAppleReady, setNativeAppleReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [weakTopics, setWeakTopics] = useState<WeakTopicInsight[]>([]);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const googleAvailable = useMemo(() => isGoogleAuthAvailable(), []);
  const emailAvailable = useMemo(() => isEmailAuthAvailable(), []);
  const authAvailable = emailAvailable || googleAvailable || appleAvailable;
  const isSigningIn = signingInWith !== null;
  const hasSocial = googleAvailable || appleAvailable;

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let progress;
        if (user?.uid) {
          try {
            progress = await syncProgressFromCloud(user.uid);
          } catch {
            progress = await loadLocalProgress();
          }
        } else {
          progress = await loadLocalProgress();
        }
        const insights = getWeakTopicInsights(progress, 3);
        if (!cancelled) {
          setWeakTopics(insights);
          if (isPremium && insights.length > 0) {
            logAnalyticsEvent('weak_topic_insights_viewed', { count: insights.length });
          }
        }
      } catch (error) {
        console.error('Failed to load weak topic insights:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, isPremium]);

  const packagePriceHint = useMemo(() => {
    const packages = offerings?.availablePackages || [];
    const pkg =
      packages.find((candidate) => candidate.product.identifier === REVENUECAT_PRODUCT_IDS.monthly) ||
      packages[0];
    return pkg?.product?.priceString || null;
  }, [offerings]);

  const handleUpgrade = useCallback(async () => {
    if (billingBusy) return;
    setBillingMessage(null);
    setBillingBusy(true);
    logAnalyticsEvent('pro_offer_viewed', { source: 'profile' });
    try {
      const unlocked = await presentPaywall('profile');
      setBillingMessage(unlocked ? 'Pro is active on this device.' : null);
    } catch (error) {
      console.error('Upgrade failed:', error);
      setBillingMessage('Could not open the upgrade screen. Please try again.');
    } finally {
      setBillingBusy(false);
    }
  }, [billingBusy, presentPaywall]);

  const handleRestore = useCallback(async () => {
    if (billingBusy) return;
    setBillingMessage(null);
    setBillingBusy(true);
    try {
      const restored = await restorePurchases();
      setBillingMessage(
        restored ? 'Purchases restored. Pro is active.' : 'No active Pro subscription found.'
      );
    } catch (error) {
      console.error('Restore failed:', error);
      setBillingMessage('Could not restore purchases. Please try again.');
    } finally {
      setBillingBusy(false);
    }
  }, [billingBusy, restorePurchases]);

  const handleManage = useCallback(async () => {
    if (billingBusy) return;
    setBillingMessage(null);
    setBillingBusy(true);
    try {
      await manageSubscription();
    } catch (error) {
      console.error('Manage subscription failed:', error);
      setBillingMessage('Could not open subscription management.');
    } finally {
      setBillingBusy(false);
    }
  }, [billingBusy, manageSubscription]);

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
  }, [user]);

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

  const handleEmailAuth = useCallback(async () => {
    if (isSigningIn || !emailAvailable) return;
    setSignInError(null);

    if (authMode === 'register' && password !== confirmPassword) {
      setSignInError('Passwords do not match.');
      return;
    }

    setSigningInWith('email');
    try {
      if (authMode === 'register') {
        await emailRegister(email, password);
        logAnalyticsEvent('sign_up', { method: 'email' });
      } else {
        await emailLogin(email, password);
        logAnalyticsEvent('login', { method: 'email' });
      }
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Email auth failed:', error);
      setSignInError(getEmailAuthErrorMessage(error));
    } finally {
      setSigningInWith(null);
    }
  }, [
    authMode,
    confirmPassword,
    email,
    emailAvailable,
    isSigningIn,
    password,
  ]);

  const switchAuthMode = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setSignInError(null);
    setConfirmPassword('');
  }, []);

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
        body: 'Merging your accounting progress with your cloud account.',
      };
    }
    return {
      tone: 'emerald' as const,
      icon: 'checkmark-circle-outline' as const,
      title: 'Progress backed up to the cloud',
      body: "You're signed in. Your accounting progress and stats sync to your account and follow you across devices.",
    };
  }, [isLoading, syncState, user]);

  const emailForm = emailAvailable ? (
    <View style={styles.emailBlock}>
      {hasSocial && (
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <ThemedText style={styles.dividerText}>or continue with email</ThemedText>
          <View style={styles.dividerLine} />
        </View>
      )}

      <View style={styles.modeToggle}>
        <Pressable
          onPress={() => switchAuthMode('signin')}
          disabled={isSigningIn}
          style={[styles.modeChip, authMode === 'signin' && styles.modeChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: authMode === 'signin' }}
          accessibilityLabel="Sign in with email"
        >
          <ThemedText
            style={[styles.modeChipText, authMode === 'signin' && styles.modeChipTextActive]}
          >
            Sign in
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => switchAuthMode('register')}
          disabled={isSigningIn}
          style={[styles.modeChip, authMode === 'register' && styles.modeChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: authMode === 'register' }}
          accessibilityLabel="Create account"
        >
          <ThemedText
            style={[styles.modeChipText, authMode === 'register' && styles.modeChipTextActive]}
          >
            Create account
          </ThemedText>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={brand.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        editable={!isSigningIn}
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={brand.textMuted}
        secureTextEntry
        textContentType={authMode === 'register' ? 'newPassword' : 'password'}
        autoComplete={authMode === 'register' ? 'password-new' : 'password'}
        editable={!isSigningIn}
        accessibilityLabel="Password"
      />
      {authMode === 'register' && (
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor={brand.textMuted}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
          editable={!isSigningIn}
          accessibilityLabel="Confirm password"
        />
      )}

      <Pressable
        onPress={handleEmailAuth}
        disabled={isSigningIn}
        style={({ pressed }) => [
          styles.emailButton,
          (pressed || signingInWith === 'email') && styles.pressed,
          isSigningIn && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={authMode === 'register' ? 'Create account' : 'Sign in'}
      >
        {signingInWith === 'email' ? (
          <ActivityIndicator color="#0B1220" />
        ) : (
          <Ionicons
            name={authMode === 'register' ? 'person-add-outline' : 'mail-outline'}
            size={20}
            color="#0B1220"
          />
        )}
        <ThemedText style={styles.emailButtonText}>
          {signingInWith === 'email'
            ? authMode === 'register'
              ? 'Creating account…'
              : 'Signing in…'
            : authMode === 'register'
              ? 'Create account'
              : 'Sign in with email'}
        </ThemedText>
      </Pressable>
    </View>
  ) : null;

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

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
              {emailForm}
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

          <View style={styles.proSection} accessibilityRole="summary">
            <View style={styles.proSectionHeader}>
              <ThemedText style={styles.proEyebrow}>
                {isPremium ? 'Pro membership' : 'Upgrade'}
              </ThemedText>
              <ThemedText style={styles.proTitle}>
                {isPremium ? 'Accounting CPA Quiz Pro is active' : 'Unlock Accounting CPA Quiz Pro'}
              </ThemedText>
              <ThemedText style={styles.proBody}>
                {isPremium
                  ? 'You have full access to Levels 3–4, unlimited practice, worked explanations, and weak-topic insights.'
                  : 'Free includes up to 15 Level 1 questions per subtopic and up to 3 completed Level 2 questions total. Levels 3 and 4 require Pro.'}
              </ThemedText>
            </View>

            <View style={styles.benefitList}>
              {(isPremium
                ? [
                    'Unlimited Levels 1 and 2',
                    'Full Levels 3 and 4 for every topic',
                    'Unlimited step-by-step practice',
                    'Worked solutions',
                    'Weak-topic insights',
                  ]
                : [
                    'Level 1: 15 questions per subtopic',
                    'Level 2: 3 completed questions total',
                    'Level 3: Pro only',
                    'Level 4: Pro only',
                    '3 step-by-step practice questions/day',
                    'Worked solutions',
                    'Weak-topic insights',
                  ]
              ).map((item) => (
                <View key={item} style={styles.benefitRow}>
                  <Ionicons
                    name={isPremium ? 'checkmark-circle' : 'lock-closed'}
                    size={18}
                    color={isPremium ? brand.emerald : brand.amber}
                  />
                  <ThemedText style={styles.benefitText}>{item}</ThemedText>
                </View>
              ))}
            </View>

            {!isPremium && (
              <ThemedText style={styles.proMeta}>
                Free daily allowance: {FREE_PRACTICE_DAILY_LIMIT} step-by-step practice questions
                {packagePriceHint ? ` · Plans from ${packagePriceHint}` : ''}
              </ThemedText>
            )}

            <View style={styles.weakBlock}>
              <ThemedText style={styles.weakTitle}>Weak-topic insights</ThemedText>
              {isPremium ? (
                weakTopics.length > 0 ? (
                  weakTopics.map((topic) => (
                    <View key={topic.key} style={styles.weakRow}>
                      <ThemedText style={styles.weakLabel} numberOfLines={1}>
                        {topic.label}
                      </ThemedText>
                      <ThemedText style={styles.weakMeta}>
                        {topic.mastery}% · {topic.attempted} attempts
                      </ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText style={styles.proMeta}>
                    Complete more accounting questions to unlock personalized weak areas.
                  </ThemedText>
                )
              ) : (
                <ThemedText style={styles.proMeta}>
                  Pro identifies your weakest attempted topics from your practice statistics.
                </ThemedText>
              )}
            </View>

            {!!billingMessage && (
              <ThemedText style={styles.billingMessage}>{billingMessage}</ThemedText>
            )}

            {!isPremium ? (
              <Pressable
                onPress={handleUpgrade}
                disabled={billingBusy}
                style={({ pressed }) => [
                  styles.upgradeButton,
                  (pressed || billingBusy) && styles.pressed,
                  billingBusy && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Pro"
              >
                <ThemedText style={styles.upgradeButtonText}>
                  {billingBusy ? 'Please wait…' : 'Upgrade to Accounting CPA Quiz Pro'}
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleManage}
                disabled={billingBusy}
                style={({ pressed }) => [
                  styles.manageButton,
                  (pressed || billingBusy) && styles.pressed,
                  billingBusy && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Manage Subscription"
              >
                <ThemedText style={styles.manageButtonText}>Manage Subscription</ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={handleRestore}
              disabled={billingBusy}
              style={({ pressed }) => [
                styles.restoreButton,
                (pressed || billingBusy) && styles.pressed,
                billingBusy && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Restore Purchases"
            >
              <ThemedText style={styles.restoreButtonText}>Restore Purchases</ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={goHome}
            style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
            accessibilityRole="link"
            accessibilityLabel="Back to home"
          >
            <ThemedText style={styles.backLinkText}>Back to home</ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
  emailBlock: {
    gap: 12,
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  dividerText: {
    color: brand.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 4,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeChipActive: {
    backgroundColor: 'rgba(20, 184, 166, 0.18)',
  },
  modeChipText: {
    color: brand.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modeChipTextActive: {
    color: brand.primarySoft,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: brand.text,
    fontSize: 16,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: brand.primarySoft,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  emailButtonText: {
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
  proSection: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  proSectionHeader: {
    gap: 6,
  },
  proEyebrow: {
    color: brand.amber,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  proTitle: {
    color: brand.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  proBody: {
    color: brand.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  benefitList: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    flex: 1,
    color: brand.text,
    fontSize: 15,
    fontWeight: '600',
  },
  proMeta: {
    color: brand.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  weakBlock: {
    gap: 8,
    paddingTop: 4,
  },
  weakTitle: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '700',
  },
  weakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  weakLabel: {
    flex: 1,
    color: brand.textSecondary,
    fontSize: 14,
  },
  weakMeta: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  billingMessage: {
    color: brand.primarySoft,
    fontSize: 14,
    lineHeight: 20,
  },
  upgradeButton: {
    borderRadius: 14,
    backgroundColor: brand.primary,
    paddingVertical: 15,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '800',
  },
  manageButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.cardElevated,
    paddingVertical: 14,
    alignItems: 'center',
  },
  manageButtonText: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreButtonText: {
    color: brand.primarySoft,
    fontSize: 15,
    fontWeight: '600',
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
