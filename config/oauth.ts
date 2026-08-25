/** Google OAuth client IDs for Matric Unlocked (Firebase project matric-unlocked). */

/** Web client ID — required by Google Sign-In to return an ID token Firebase Auth accepts. */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '53521587720-dnvm4id4m69h6epcoqer7u6i4u8869ka.apps.googleusercontent.com';

/** iOS OAuth client from GoogleService-Info.plist (bundle com.dimpoaccounting). */
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '53521587720-ur7dsvk6on4vaile0pr0litvpkhai6qj.apps.googleusercontent.com';

/** Reversed iOS client ID used as the Google Sign-In URL scheme. */
export const GOOGLE_IOS_URL_SCHEME =
  'com.googleusercontent.apps.53521587720-ur7dsvk6on4vaile0pr0litvpkhai6qj';

/** @deprecated Use GOOGLE_WEB_CLIENT_ID */
export const GOOGLE_CLIENT_ID = GOOGLE_WEB_CLIENT_ID;

/** @deprecated Use GOOGLE_WEB_CLIENT_ID */
export const GOOGLE_EXPO_CLIENT_ID = GOOGLE_WEB_CLIENT_ID;

/** @deprecated Android OAuth client is created when a SHA-1 is registered in Firebase. */
export const GOOGLE_ANDROID_CLIENT_ID = GOOGLE_WEB_CLIENT_ID;
