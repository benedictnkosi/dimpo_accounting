#!/bin/bash

# Exit on error
set -e

# Copy google-services.json to the correct location
echo "Copying google-services.json to app directory..."
cp google-services.json android/app/google-services.json

# Copy and rename keystore file
echo "Copying and renaming keystore file..."
cp @nkosib__exam-quiz.jks android/app/keystore.jks

# Copy build.gradle files to android directory
echo "Copying build.gradle files to android directory..."
cp android-build.gradle android/build.gradle

# Persist version bumps in app-build.gradle (source of truth), then copy into android/
echo "Updating versions in app-build.gradle..."

CURRENT_CODE=$(grep 'versionCode' app-build.gradle | head -1 | grep -o '[0-9]\+')
CURRENT_NAME=$(grep 'versionName' app-build.gradle | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')

NEW_CODE=$((CURRENT_CODE + 1))
NEW_NAME=$(echo "$CURRENT_NAME" | awk -F. '{$NF = $NF + 1;}1' OFS=.)

sed -i '' "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" app-build.gradle
sed -i '' "s/versionName \"$CURRENT_NAME\"/versionName \"$NEW_NAME\"/" app-build.gradle

echo "Updated version from $CURRENT_CODE ($CURRENT_NAME) to $NEW_CODE ($NEW_NAME)"

cp app-build.gradle android/app/build.gradle

# Navigate to android directory and run build commands
cd android
./gradlew clean
./gradlew bundleRelease

# Copy the AAB file (path must be quoted because of spaces)
cp app/build/outputs/bundle/release/app-release.aab "/Users/benedictnkosi/Documents/Dimpo Learning Assets/app-release.aab"

echo "Build completed! versionCode=$NEW_CODE versionName=$NEW_NAME"
