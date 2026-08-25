export default {
  name: 'Accounting CPA QUIZ',
  // EAS project @nkosib/exam-quiz (slug cannot be changed on Expo).
  slug: 'exam-quiz',
  version: '4',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'dimpoaccounting',
  userInterfaceStyle: 'dark',
  newArchEnabled: false,
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.dimpoaccounting',
    buildNumber: '4',
    usesAppleSignIn: true,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      "ITSAppUsesNonExemptEncryption": false,
      "UIBackgroundModes": ["remote-notification"]
    },
    "associatedDomains": ["applinks:examquiz.co.za"],
    "storeKitConfiguration": "./ios/DimpoAccounting/Configuration.storekit"
  },
  android: {
    package: 'com.accountingtutor',
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          {
            "scheme": "https",
            "host": "examquiz.co.za",
            "pathPrefix": "/"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ],
    versionCode: 3,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: ["NOTIFICATIONS"]
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png'
  },
  plugins: [
    'expo-router',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          'com.googleusercontent.apps.53521587720-ur7dsvk6on4vaile0pr0litvpkhai6qj',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: "36.0.0",
          kotlinVersion: "2.0.21",
          enableWebP: true
        },
        ios: {
          deploymentTarget: "15.1"
        }
      }
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0B1220'
      }
    ],
    [
      'expo-notifications',
      {
        color: '#ffffff'
      }
    ],
    [
      'expo-asset',
      {
        assets: [
          './assets/audio/correct.mp3',
          './assets/audio/wrong.mp3',
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {
      origin: false
    },
    eas: {
      projectId: 'b4f9ab87-947e-4014-8990-0c11fa29cb2c'
    },
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "AIzaSyCaJHGdAh4f7BRJxNDRNkJ_vrrG74Ur_jA",
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseMeasurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.EXPO_PUBLIC_SITE_URL || 'https://matricunlocked.co.za',
  },
  owner: 'nkosib',
  runtimeVersion: '1.0.0',
  updates: {
    url: 'https://u.expo.dev/b4f9ab87-947e-4014-8990-0c11fa29cb2c'
  }
}; 
