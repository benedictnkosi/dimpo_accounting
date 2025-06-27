# Dimpo Accounting

A comprehensive accounting learning app designed to help students master core accounting concepts through interactive lessons and practice exercises.

## Features

- **6 Core Accounting Topics**: Financial Statements, Cash Flow & Equity, Ratio Analysis & Interpretation, Cost Concepts & Internal Control, Corporate Governance & Ethics, and Company Capital & Shareholders
- **Interactive Lessons**: Engaging practice exercises with real-world examples
- **Progress Tracking**: Monitor your learning progress across all topics
- **Adaptive Learning**: Personalized difficulty levels based on your performance
- **Offline Support**: Download lessons for offline learning
- **Progress Analytics**: Detailed insights into your learning journey

## Topics Covered

1. **Financial Statements** - Core reporting: Income Statement, Balance Sheet, Depreciation, Adjustments
2. **Cash Flow & Equity** - Cash flow reporting, retained income, dividends, share capital changes
3. **Ratio Analysis & Interpretation** - Profitability, liquidity, solvency, trends, decision-making
4. **Cost Concepts & Internal Control** - Costing, inventory, mark-up, petty cash, bank control
5. **Corporate Governance & Ethics** - Auditors, directors, stakeholder ethics, internal controls
6. **Company Capital & Shareholders** - Share types, share issues, earnings per share, dividends, NAV

## Getting Started

1. Download the app from the App Store or Google Play Store
2. Create an account or continue as a guest
3. Choose your avatar
4. Select an accounting topic to start learning
5. Complete interactive lessons and track your progress

## Technology Stack

- React Native with Expo
- TypeScript
- Firebase Authentication
- AsyncStorage for local data persistence
- React Navigation for routing

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Contributing

This app is designed for educational purposes. Feel free to contribute by reporting bugs or suggesting new features.

## License

This project is licensed under the MIT License.

## Environment Setup

### Android Development Setup

1. Download and install Android Studio from [developer.android.com](https://developer.android.com/studio)

2. Set up your ANDROID_HOME environment variable:

   For macOS/Linux, add these lines to your `~/.bash_profile`, `~/.zshrc`, or equivalent:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

   For Windows, set the environment variable through System Properties:
   - Open System Properties > Advanced > Environment Variables
   - Add new System Variable:
     - Variable name: ANDROID_HOME
     - Variable value: C:\Users\YourUsername\AppData\Local\Android\Sdk

3. After setting the environment variables, restart your terminal and IDE

4. In Android Studio:
   - Go to Tools > SDK Manager
   - Install the following:
     - Android SDK Platform Tools
     - At least one Android SDK Platform (recommended: Android 13 (API Level 33))
     - Android SDK Build-Tools


### run on android emulator
npx expo run:android

### build code
npx expo prebuild

### build apk for preview
eas build --profile preview --platform android

### build apk for production
eas build --profile production --platform android

### build apk for development
eas build --profile development --platform android

### manage credentials
eas credentials
px expo credentials:manager --info

submit to android



eas submit --platform android


### build aab for production locally
First, locate your Expo keystore. It's stored in your Expo credentials. You can download it using:

eas credentials --platform android

Then select:
Your build profile (production)
"Keystore: Manage everything needed to build your project"
"Download Keystore"
Create a gradle.properties file in android/app/ with these credentials (you'll get the actual values after downloading the keystore):

MYAPP_UPLOAD_STORE_FILE=keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=18a2509529bd69f94e3d92cb654ab2ca
MYAPP_UPLOAD_STORE_PASSWORD=<keystore password from expo>
MYAPP_UPLOAD_KEY_PASSWORD=<key password from expo>

Move the downloaded keystore file to android/app/keystore.jks
Update your android/app/build.gradle:

android {
    // ... existing code ...
    
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('keystore.jks')
            storePassword "c4ea0fa65c00c133a38786b86790a73e"
            keyAlias "18a2509529bd69f94e3d92cb654ab2ca"
            keyPassword "291654a144e727dac362827c1344cc54"
        }
    }
}


## Then build your AAB:
change the  versionCode in /Users/mac1/Documents/cursor/examquiz/android/app/build.gradle
defaultConfig {
        applicationId 'com.dimpolanguages'
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 201
        versionName "2.0.1"
    }

cd android
./gradlew clean
./gradlew bundleRelease

## or just run the build.sh script
./build.sh


### clean project
npx expo prebuild --clean


### clean build
npx expo prebuild --clean && npx expo run:android

cd android && ./gradlew clean

./build-aab.sh


### build apk
./build-apk.sh


### IOS
 
## open emulator 
open -a Simulator

allow firebase on ios
add line:
 use_modular_headers!
 pod 'FirebaseCore', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
  pod 'FirebaseAuth', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true

  use_frameworks! :linkage => :static
  
/Users/mac1/Documents/cursor/examquiz-launch/examquiz/ios/Podfile

or
move the Podfile into the ios folder

expo prebuild
cd ios && pod install && cd ..
npx expo run:ios



## 3 clean and build
cd ios && rm -rf Pods Podfile.lock && pod deintegrate && pod cache clean --all && pod install && cd .. && npx expo run:ios

## using xcode build
xcodebuild -workspace examquiz.xcworkspace -scheme examquiz -configuration Release clean build | grep -E "error:|warning:" || echo "Build completed successfully with no errors"



## Steps
cd ios && rm -rf Pods build && cd ..

rm -rf node_modules && npm cache clean --force && npm install

npx expo run:ios

## Failed?

d ios && rm -rf build/ DerivedData/ && cd ..

cd ios && rm -rf Pods/ Podfile.lock && cd ..

rm -rf node_modules/ && npm cache clean --force && npm install

cd ios && pod install --repo-update && cd ..

npx expo run:ios


## xcode
xcode open workspace

menu - > Product -> archive


## run on real IOS device
npx expo run:ios --device

npx expo-doctor


## expo notifications 

### android/app/build.gradle
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"
apply plugin: 'com.google.gms.google-services' // This must be at the bottom


### android/build.gradle
dependencies {
        classpath('com.android.tools.build:gradle')
        classpath('com.facebook.react:react-native-gradle-plugin')
        classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
        classpath('com.google.gms:google-services:4.4.1')   
    }

### make sure file exists
android/app/google-services.json

### make sure file exists - google-services.json
"api_key": [
        {
          "current_key": "AIzaSyByCggGOKgD-STXUohFPRg6c1YRsT_C2jo"
        }
      ],