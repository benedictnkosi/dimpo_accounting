import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  correctMp3Base64,
  correctMp3Bytes,
  wrongMp3Base64,
  wrongMp3Bytes,
} from '@/assets/audio/soundBase64';

const SOUND_DATA = {
  correct: { base64: correctMp3Base64, bytes: correctMp3Bytes },
  wrong: { base64: wrongMp3Base64, bytes: wrongMp3Bytes },
} as const;

type FeedbackSound = keyof typeof SOUND_DATA;

let player: Audio.Sound | null = null;
const cachedUris: Partial<Record<FeedbackSound, string>> = {};
let audioModeReady = false;

async function cacheSoundUri(type: FeedbackSound): Promise<string> {
  if (cachedUris[type]) return cachedUris[type]!;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('No local cache directory available for sounds');
  }

  const dest = `${cacheDir}feedback-${type}.mp3`;
  const expected = SOUND_DATA[type].bytes;
  const existing = await FileSystem.getInfoAsync(dest);

  if (!existing.exists || existing.size !== expected) {
    await FileSystem.writeAsStringAsync(dest, SOUND_DATA[type].base64, {
      encoding: 'base64',
    });
  }

  cachedUris[type] = dest;
  return dest;
}

export async function preloadFeedbackSounds(): Promise<void> {
  await Promise.all((Object.keys(SOUND_DATA) as FeedbackSound[]).map((type) => cacheSoundUri(type)));
}

export async function playLocalFeedbackSound(type: FeedbackSound): Promise<void> {
  if (!audioModeReady) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioModeReady = true;
  }

  if (player) {
    try {
      await player.unloadAsync();
    } catch {
      // already unloaded
    }
    player = null;
  }

  const uri = await cacheSoundUri(type);
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume: 1.0 },
    undefined,
    true
  );
  player = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
      if (player === sound) player = null;
    }
  });
}
