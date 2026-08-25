import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { setAnalyticsUserId } from '@/services/analytics';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: async () => { throw new Error('AuthContext not initialized'); },
  refreshUser: async () => { throw new Error('AuthContext not initialized'); },
});


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Attempt to restore from SecureStore first
    async function restoreFromSecureStore() {
      try {
        const storedAuth = await SecureStore.getItemAsync('auth');
        if (storedAuth && !user && isMounted) {
          const { user: storedUser } = JSON.parse(storedAuth);
          setUser(storedUser);
        }
      } catch (error) {
        console.error('Error restoring auth from SecureStore:', error);
      }
    }

    // Then set up Firebase auth listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        const userData: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        // Store in SecureStore as backup
        await SecureStore.setItemAsync('auth', JSON.stringify({ user: userData }));
        setUser(userData);
        setAnalyticsUserId(firebaseUser.uid);
      } else {
        setUser(null);
        setAnalyticsUserId(null);
        await SecureStore.deleteItemAsync('auth');
      }
      setIsLoading(false);
    });

    restoreFromSecureStore();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const persistUser = async (firebaseUser: NonNullable<typeof auth.currentUser>) => {
    const userData: AuthUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
    };
    await SecureStore.setItemAsync('auth', JSON.stringify({ user: userData }));
    setUser(userData);
    setAnalyticsUserId(firebaseUser.uid);
  };

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await firebaseUser.reload();
    await persistUser(firebaseUser);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    await SecureStore.deleteItemAsync('auth');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
