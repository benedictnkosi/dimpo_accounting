import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/services/analytics';
import {
  hasPremiumEntitlement,
  isPurchasesSupported,
  PREMIUM_ENTITLEMENT_ID,
  PurchasePackage,
  revenueCatService,
} from '@/services/revenueCat';

interface RevenueCatContextType {
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  isLoading: boolean;
  error: Error | null;
  isPremium: boolean;
  purchasePackage: (packageToPurchase: PurchasePackage) => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  identifyUser: (userId: string) => Promise<void>;
  resetUser: () => Promise<void>;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  presentPaywall: (source?: string) => Promise<boolean>;
  manageSubscription: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

function emptyCustomerInfo(): CustomerInfo {
  return {
    entitlements: { active: {}, all: {}, verification: 'NOT_REQUESTED' },
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
  } as unknown as CustomerInfo;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const previousUid = useRef<string | null>(null);
  const paywallOpenRef = useRef(false);

  useEffect(() => {
    void initializeRevenueCat();
  }, []);

  async function initializeRevenueCat() {
    try {
      setIsLoading(true);
      setError(null);

      await revenueCatService.initialize();

      const [nextCustomerInfo, nextOfferings] = await Promise.all([
        revenueCatService.getCustomerInfo().catch(() => emptyCustomerInfo()),
        revenueCatService.getOfferings(),
      ]);

      setCustomerInfo(nextCustomerInfo);
      setOfferings(nextOfferings);
      setIsReady(true);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to initialize RevenueCat');
      setError(nextError);
      console.warn('RevenueCat initialization failed:', nextError.message);
      if (__DEV__) {
        setCustomerInfo(emptyCustomerInfo());
        setOfferings(null);
        setIsReady(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady || !isPurchasesSupported()) return;
    return revenueCatService.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;

    const onAppStateChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      void revenueCatService
        .getCustomerInfo()
        .then((info) => setCustomerInfo(info))
        .catch((err) => console.warn('Failed to refresh customer info on resume:', err));
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [isReady]);

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

    void syncRevenueCatUser();
  }, [isReady, user?.uid]);

  const purchasePackage = useCallback(async (packageToPurchase: PurchasePackage) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedCustomerInfo = await revenueCatService.purchasePackage(packageToPurchase);
      setCustomerInfo(updatedCustomerInfo);
      if (hasPremiumEntitlement(updatedCustomerInfo)) {
        await analytics.track('purchase_completed', {
          package_id: packageToPurchase.identifier,
        });
      }
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to purchase package');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedCustomerInfo = await revenueCatService.restorePurchases();
      setCustomerInfo(updatedCustomerInfo);
      const premium = hasPremiumEntitlement(updatedCustomerInfo);
      if (premium) {
        await analytics.track('purchase_restored', {});
      }
      return premium;
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to restore purchases');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const identifyUser = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await revenueCatService.identifyUser(userId);
      const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
      setCustomerInfo(updatedCustomerInfo);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to identify user');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await revenueCatService.resetUser();
      const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
      setCustomerInfo(updatedCustomerInfo);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to reset user');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCustomerInfo = useCallback(async (): Promise<CustomerInfo | null> => {
    try {
      const updatedCustomerInfo = await revenueCatService.getCustomerInfo();
      setCustomerInfo(updatedCustomerInfo);
      return updatedCustomerInfo;
    } catch (err) {
      console.error('Failed to refresh customer info:', err);
      return customerInfo;
    }
  }, [customerInfo]);

  const presentPaywall = useCallback(
    async (source = 'unknown'): Promise<boolean> => {
      if (paywallOpenRef.current) return hasPremiumEntitlement(customerInfo);
      paywallOpenRef.current = true;

      try {
        await analytics.track('paywall_opened', { source });

        const currentOfferings = offerings || (await revenueCatService.getOfferings());
        if (!currentOfferings) {
          throw new Error('No offerings available');
        }

        const { result, customerInfo: updated, isPremium: nowPremium } =
          await revenueCatService.presentPaywall(currentOfferings);

        if (updated) setCustomerInfo(updated);

        const purchasedOrRestored =
          result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;

        // Only confirm success when the named entitlement is active.
        if (purchasedOrRestored && nowPremium) {
          const productId =
            updated?.entitlements.active[PREMIUM_ENTITLEMENT_ID]?.productIdentifier || 'unknown';
          await analytics.track(
            result === PAYWALL_RESULT.RESTORED ? 'purchase_restored' : 'purchase_completed',
            {
              source,
              product_id: productId,
            }
          );
          return true;
        }

        await analytics.track('paywall_closed', { source });
        // A fresh response is authoritative, including when it says access expired.
        return updated ? hasPremiumEntitlement(updated) : hasPremiumEntitlement(customerInfo);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await analytics.track('paywall_error', { source, error: message });
        // Missing offerings is almost always dashboard / store config, not an app crash.
        if (message.includes('No offerings available')) {
          console.warn(
            'Failed to show paywall: no RevenueCat offerings. Mark a Default offering as Current and attach monthly/annual products.'
          );
        } else {
          console.error('Failed to show paywall:', err);
        }
        return hasPremiumEntitlement(customerInfo);
      } finally {
        paywallOpenRef.current = false;
      }
    },
    [customerInfo, offerings]
  );

  const manageSubscription = useCallback(async () => {
    await analytics.track('subscription_manage_opened', {});
    await revenueCatService.openManageSubscriptions(customerInfo);
  }, [customerInfo]);

  const isPremium = hasPremiumEntitlement(customerInfo);

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
      manageSubscription,
    }),
    [
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
      manageSubscription,
    ]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}
