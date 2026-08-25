import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
  UserCredential,
} from 'firebase/auth';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config/oauth';
import { auth } from '@/config/firebase';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let googleSignInModule: GoogleSignInModule | null | undefined;
let configuredWebClientId: string | null = null;

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in cancelled');
    this.name = 'GoogleSignInCancelledError';
  }
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function loadGoogleSignIn(): GoogleSignInModule | null {
  if (googleSignInModule !== undefined) return googleSignInModule;
  if (isExpoGo() || Platform.OS === 'web') {
    googleSignInModule = null;
    return null;
  }

  try {
    // Native module is unavailable in Expo Go — require must be guarded.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  } catch {
    googleSignInModule = null;
  }

  return googleSignInModule;
}

function configureGoogleSignIn(module: GoogleSignInModule) {
  if (configuredWebClientId === GOOGLE_WEB_CLIENT_ID) return;
  module.GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : undefined,
    offlineAccess: true,
  });
  configuredWebClientId = GOOGLE_WEB_CLIENT_ID;
}

export function isGoogleAuthAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const module = loadGoogleSignIn();
    if (!module) return false;
    configureGoogleSignIn(module);
    return typeof module.GoogleSignin.signIn === 'function';
  } catch {
    return false;
  }
}

export async function googleLogin(): Promise<UserCredential> {
  const module = loadGoogleSignIn();
  if (!module) {
    throw new Error('Google sign-in requires a development build (not available in Expo Go)');
  }

  configureGoogleSignIn(module);

  if (Platform.OS === 'android') {
    await module.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await module.GoogleSignin.signIn();

  if (module.isCancelledResponse(response)) {
    throw new GoogleSignInCancelledError();
  }

  if (!module.isSuccessResponse(response)) {
    throw new Error('Google sign-in failed');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('No ID token present');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function googleSignOut(): Promise<void> {
  try {
    const module = loadGoogleSignIn();
    if (!module) return;
    configureGoogleSignIn(module);
    await module.GoogleSignin.signOut();
  } catch (error) {
    console.warn('Google sign-out skipped:', error);
  }
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  if (error instanceof GoogleSignInCancelledError) return true;
  const module = loadGoogleSignIn();
  if (!module) return false;
  return module.isErrorWithCode(error) && error.code === module.statusCodes.SIGN_IN_CANCELLED;
}

type AppleAuthModule = typeof import('expo-apple-authentication');

let appleAuthModule: AppleAuthModule | null | undefined;

export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Apple sign-in cancelled');
    this.name = 'AppleSignInCancelledError';
  }
}

function loadAppleAuth(): AppleAuthModule | null {
  if (appleAuthModule !== undefined) return appleAuthModule;
  if (Platform.OS !== 'ios') {
    appleAuthModule = null;
    return null;
  }

  try {
    // Native module may be missing until an iOS rebuild — require must be guarded.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appleAuthModule = require('expo-apple-authentication') as AppleAuthModule;
  } catch {
    appleAuthModule = null;
  }

  return appleAuthModule;
}

function formatAppleFullName(
  fullName?: {
    givenName: string | null;
    middleName: string | null;
    familyName: string | null;
  } | null
): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  return parts.length ? parts.join(' ') : null;
}

async function generateAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const rawNonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );
  return { rawNonce, hashedNonce };
}

export function isAppleAuthSupported(): boolean {
  return Platform.OS === 'ios';
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (!isAppleAuthSupported()) return false;
  const module = loadAppleAuth();
  if (!module) return false;
  try {
    return await module.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function appleLogin(): Promise<UserCredential> {
  const module = loadAppleAuth();
  if (!module) {
    throw new Error('APPLE_SIGN_IN_REBUILD_REQUIRED');
  }

  const { rawNonce, hashedNonce } = await generateAppleNonce();
  let appleCredential;
  try {
    appleCredential = await module.signInAsync({
      requestedScopes: [
        module.AppleAuthenticationScope.FULL_NAME,
        module.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (isAppleSignInCancelled(error)) {
      throw new AppleSignInCancelledError();
    }
    throw error;
  }

  if (!appleCredential.identityToken) {
    throw new Error('No identity token present');
  }

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
    // Required by Firebase JS SDK — omitting this often yields auth/invalid-credential
    // ("Invalid OAuth response from apple.com") after a successful Apple Face ID prompt.
    ...(appleCredential.authorizationCode
      ? { accessToken: appleCredential.authorizationCode }
      : {}),
  });
  const userCredential = await signInWithCredential(auth, credential);

  const displayName = formatAppleFullName(appleCredential.fullName);
  if (displayName && !userCredential.user.displayName) {
    try {
      await updateProfile(userCredential.user, { displayName });
    } catch (error) {
      console.warn('Could not save Apple display name:', error);
    }
  }

  return userCredential;
}

export function isAppleSignInCancelled(error: unknown): boolean {
  if (error instanceof AppleSignInCancelledError) return true;
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = String((error as { code?: string }).code);
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}
