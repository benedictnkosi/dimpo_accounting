import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/services/analytics';
import { setUserPremium } from '@/services/progress';
import { hasPremiumEntitlement, isPurchasesSupported, PurchasePackage, revenueCatService } from '../services/revenueCat';

interface RevenueCatContextType {
    customerInfo: CustomerInfo | null;
    offerings: PurchasesOffering | null;
    isLoading: boolean;
    error: Error | null;
    isPremium: boolean;
    purchasePackage: (packageToPurchase: PurchasePackage) => Promise<void>;
    restorePurchases: () => Promise<void>;
    identifyUser: (userId: string) => Promise<void>;
    resetUser: () => Promise<void>;
    refreshCustomerInfo: () => Promise<CustomerInfo | null>;
    presentPaywall: (userId?: string | null) => Promise<boolean>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoading: isAuthLoading } = useAuth();
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
    const [firestorePremium, setFirestorePremium] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const previousUid = useRef<string | null>(null);
    const lastSyncedPremium = useRef<boolean | null>(null);

    useEffect(() => {
        initializeRevenueCat();
    }, []);

    async function initializeRevenueCat() {
        try {
            setIsLoading(true);
            setError(null);
            
            await revenueCatService.initialize();
            
            const [customerInfo, offerings] = await Promise.all([
                revenueCatService.getCustomerInfo(),
                revenueCatService.getOfferings(),
            ]);
            
            setCustomerInfo(customerInfo);
            setOfferings(offerings);
            setIsReady(true);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to initialize RevenueCat');
            setError(error);
            console.warn('RevenueCat initialization failed:', error.message);
            
            // In development, don't let RevenueCat errors crash the app
            if (__DEV__) {
                // Set default values to allow app to continue
                setCustomerInfo({
                    entitlements: { active: {} },
                    allPurchaseDates: {},
                    allExpirationDates: {},
                    allPurchasedProductIdentifiers: [],
                    latestExpirationDate: null,
                    firstSeen: new Date().toISOString(),
                    originalAppUserId: '',
                    requestDate: new Date().toISOString(),
                    originalApplicationVersion: '',
                    originalPurchaseDate: null,
                    managementURL: null,
                    nonSubscriptionTransactions: [],
                    activeSubscriptions: [],
                    subscriptionsByProductIdentifier: {},
                } as unknown as CustomerInfo);
                setOfferings(null);
            }
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        if (!user?.uid) {
            setFirestorePremium(false);
            return;
        }
        // Wait for Firebase auth so Firestore rules can authorize the user doc read.
        if (isAuthLoading) return;

        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            (snap) => {
                setFirestorePremium(!!snap.data()?.premium);
            },
            (err) => {
                console.error('Failed to listen for premium status:', err);
            }
        );

        return unsubscribe;
    }, [isAuthLoading, user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            lastSyncedPremium.current = null;
            return;
        }

        const premiumFromStore = hasPremiumEntitlement(customerInfo);
        if (!premiumFromStore || lastSyncedPremium.current === true) return;

        lastSyncedPremium.current = true;
        setUserPremium(user.uid, true).catch((err) => {
            console.error('Failed to update premium on user document:', err);
            lastSyncedPremium.current = null;
        });
    }, [customerInfo, user?.uid]);

    useEffect(() => {
        if (!isPurchasesSupported() || !isReady) return;

        async function syncRevenueCatUser() {
            try {
                if (user?.uid) await revenueCatService.identifyUser(user.uid);
                else if (previousUid.current) await revenueCatService.resetUser();
                previousUid.current = user?.uid ?? null;
                const nextCustomerInfo = await revenueCatService.getCustomerInfo();
                setCustomerInfo(nextCustomerInfo);
            } catch (err) {
                console.error('Failed to sync RevenueCat user:', err);
            }
        }

        syncRevenueCatUser();
    }, [isReady, user?.uid]);

    async function persistPremiumIfNeeded(uid: string | null | undefined, info: CustomerInfo | null) {
        if (!uid || !hasPremiumEntitlement(info)) return;
        await setUserPremium(uid, true);
        lastSyncedPremium.current = true;
    }

    async function purchasePackage(packageToPurchase: PurchasePackage) {
        try {
            setIsLoading(true);
            setError(null);
            const updatedCustomerInfo = await revenueCatService.purchasePackage(packageToPurchase);
            setCustomerInfo(updatedCustomerInfo);
            await persistPremiumIfNeeded(user?.uid, updatedCustomerInfo);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to purchase package');
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function restorePurchases() {
        try {
            setIsLoading(true);
            setError(null);
            const updatedCustomerInfo = await revenueCatService.restorePurchases();
            setCustomerInfo(updatedCustomerInfo);
            await persistPremiumIfNeeded(user?.uid, updatedCustomerInfo);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to restore purchases');
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function identifyUser(userId: string) {
        try {
            setIsLoading(true);
            setError(null);
            await revenueCatService.identifyUser(userId);
            const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
            setCustomerInfo(updatedCustomerInfo);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to identify user');
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function resetUser() {
        try {
            setIsLoading(true);
            setError(null);
            await revenueCatService.resetUser();
            const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
            setCustomerInfo(updatedCustomerInfo);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to reset user');
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function refreshCustomerInfo(): Promise<CustomerInfo | null> {
        try {
            const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
            setCustomerInfo(updatedCustomerInfo);
            return updatedCustomerInfo;
        } catch (err) {
            console.error('Failed to refresh customer info:', err);
            return customerInfo;
        }
    }

    async function presentPaywall(userId?: string | null): Promise<boolean> {
        try {
            await analytics.track('paywall_shown', {
                userId: userId || undefined,
                timestamp: new Date().toISOString(),
            });

            if (userId) {
                await Purchases.logIn(userId);
            }

            const currentOfferings = offerings || (await revenueCatService.getOfferings());
            if (!currentOfferings) {
                throw new Error('No offerings available');
            }

            const result = await RevenueCatUI.presentPaywall({
                offering: currentOfferings,
                displayCloseButton: true,
            });

            const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
            setCustomerInfo(updatedCustomerInfo);

            const purchased =
                result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
            const nowPremium = purchased || hasPremiumEntitlement(updatedCustomerInfo);
            if (nowPremium) {
                await persistPremiumIfNeeded(userId || user?.uid, updatedCustomerInfo);
            }

            await analytics.track(nowPremium ? 'purchase_successful' : 'paywall_closed', {
                userId: userId || undefined,
                timestamp: new Date().toISOString(),
            });

            return nowPremium;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            await analytics.track('paywall_error', {
                userId: userId || undefined,
                error: message,
                timestamp: new Date().toISOString(),
            });
            console.error('Failed to show paywall:', err);
            return firestorePremium || hasPremiumEntitlement(customerInfo);
        }
    }

    const isPremium = firestorePremium || hasPremiumEntitlement(customerInfo);

    const value = useMemo(
        () => ({
            customerInfo,
            offerings,
            isLoading,
            isPremium,
            error,
            purchasePackage,
            restorePurchases,
            identifyUser,
            resetUser,
            refreshCustomerInfo,
            presentPaywall,
        }),
        [customerInfo, offerings, isLoading, isPremium, error, firestorePremium]
    );

    return (
        <RevenueCatContext.Provider value={value}>
            {children}
        </RevenueCatContext.Provider>
    );
}

export function useRevenueCat() {
    const context = useContext(RevenueCatContext);
    if (context === undefined) {
        throw new Error('useRevenueCat must be used within a RevenueCatProvider');
    }
    return context;
}
