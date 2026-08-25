import { router } from 'expo-router';

export default function AuthNavigation() {
  return null;
}

export function useAuthNavigation() {
  return {
    navigateToLogin: () => router.replace('/profile'),
    navigateToHome: () => router.replace('/(tabs)'),
  };
} 