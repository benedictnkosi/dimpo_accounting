import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface SoundContextType {
    soundEnabled: boolean;
    toggleSound: () => void;
    setSoundEnabled: (enabled: boolean) => void;
    playFeedbackSound: (type: 'correct' | 'wrong') => Promise<void>;
}

const SoundContext = createContext<SoundContextType>({
    soundEnabled: true,
    toggleSound: () => {},
    setSoundEnabled: () => {},
    playFeedbackSound: async () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
    const [soundEnabled, setSoundEnabledState] = useState(true);

    useEffect(() => {
        loadSoundSetting();
    }, []);

    const loadSoundSetting = async () => {
        try {
            const stored = await AsyncStorage.getItem('soundEnabled');
            if (stored !== null) {
                setSoundEnabledState(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading sound setting:', error);
        }
    };

    const setSoundEnabled = async (enabled: boolean) => {
        try {
            await AsyncStorage.setItem('soundEnabled', JSON.stringify(enabled));
            setSoundEnabledState(enabled);
        } catch (error) {
            console.error('Error saving sound setting:', error);
        }
    };

    const toggleSound = () => {
        setSoundEnabled(!soundEnabled);
    };

    const playFeedbackSound = async () => {};

    return (
        <SoundContext.Provider value={{ soundEnabled, toggleSound, setSoundEnabled, playFeedbackSound }}>
            {children}
        </SoundContext.Provider>
    );
}

export const useSound = () => {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
}; 