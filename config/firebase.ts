import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: extra.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBxeSS5mnEg9M3pjbXGMeoKq7juOTmzu3k',
  authDomain: extra.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'matric-unlocked.firebaseapp.com',
  projectId: extra.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'matric-unlocked',
  storageBucket: extra.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'matric-unlocked.firebasestorage.app',
  messagingSenderId: extra.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '53521587720',
  appId: extra.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:53521587720:web:db43ba4d86f79910413bbd',
  measurementId: extra.firebaseMeasurementId || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-BE253Q5BNX',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
setPersistence(auth, getReactNativePersistence(AsyncStorage)).catch((error) => {
  console.error('Error setting auth persistence:', error);
});

const db = getFirestore(app);
export const storage = getStorage(app);

export { app, auth, db };
