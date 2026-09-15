import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

/**
 * Named Pro entitlement configured in the RevenueCat dashboard.
 * RevenueCat dashboard entitlement identifier: `pro`.
 * All subscription products must remain attached to it.
 */
export const PREMIUM_ENTITLEMENT_ID = 'pro';

/** Product identifiers currently configured in App Store Connect. */
export const REVENUECAT_PRODUCT_IDS = {
  monthly: 'dimpo_accounting_monthly',
  yearly: 'dimpo_accounting_annual',
} as const;

/** Must be the Dimpo Accounting RevenueCat project — not exam-quiz / Dimpo Learning. */
const REVENUECAT_API_KEYS = {
  ios: 'appl_TiVNYAbOGyLAaxNFPaEYDYstIKO',
  android: 'goog_msDThpJmdfRbbvfXvOdkRiHTSKr',
};

interface RevenueCatConfig {
  apiKey: string;
  appUserID?: string;
}

export interface PurchasePackage extends PurchasesPackage {
  identifier: string;
  offeringIdentifier: string;
  product: PurchasesStoreProduct;
}

export type CustomerInfoListener = (info: CustomerInfo) => void;

export function hasPremiumEntitlement(
  customerInfo: CustomerInfo | null | undefined,
  entitlementId: string = PREMIUM_ENTITLEMENT_ID
): boolean {
  if (!customerInfo?.entitlements?.active) return false;
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}

export function isPurchasesSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

class RevenueCatService {
  private static instance: RevenueCatService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private customerInfoListeners = new Set<CustomerInfoListener>();
  private purchasesListenerAttached = false;

  private constructor() {}

  static getInstance(): RevenueCatService {
    if (!RevenueCatService.instance) {
      RevenueCatService.instance = new RevenueCatService();
    }
    return RevenueCatService.instance;
  }

  async initialize(config?: RevenueCatConfig): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.performInitialization(config);
    return this.initializationPromise;
  }

  private async performInitialization(config?: RevenueCatConfig): Promise<void> {
    try {
      if (!isPurchasesSupported()) {
        this.isInitialized = true;
        return;
      }

      const apiKey = config?.apiKey || this.getApiKey();
      const appUserID = config?.appUserID;

      if (!apiKey) {
        throw new Error('RevenueCat API key is required');
      }

      await Purchases.configure({
        apiKey,
        appUserID,
        useAmazon: false,
      });

      this.attachPurchasesListener();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  private getApiKey(): string {
    const platform = Platform.OS;
    if (platform !== 'ios' && platform !== 'android') {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    const apiKey = REVENUECAT_API_KEYS[platform];
    if (!apiKey) {
      throw new Error(`No RevenueCat API key found for platform: ${platform}`);
    }
    return apiKey;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private attachPurchasesListener(): void {
    if (this.purchasesListenerAttached || !isPurchasesSupported()) return;
    Purchases.addCustomerInfoUpdateListener((info) => {
      this.customerInfoListeners.forEach((listener) => listener(info));
    });
    this.purchasesListenerAttached = true;
  }

  addCustomerInfoUpdateListener(listener: CustomerInfoListener): () => void {
    this.customerInfoListeners.add(listener);
    if (this.isInitialized) {
      this.attachPurchasesListener();
    }
    return () => {
      this.customerInfoListeners.delete(listener);
    };
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    await this.ensureInitialized();
    if (!isPurchasesSupported()) return null;
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) return offerings.current;

      const available = Object.values(offerings.all);
      if (available.length > 0) {
        console.warn(
          'RevenueCat has offerings but none is marked Current; using the first available offering.',
          available.map((o) => o.identifier)
        );
        return available[0] ?? null;
      }

      console.warn(
        'RevenueCat returned no offerings. In the dashboard: create a Default offering, attach products, and mark it Current. Also confirm App Store / Play products are approved and the API key matches this app.'
      );
      return null;
    } catch (error) {
      console.warn('Failed to get offerings:', error);
      return null;
    }
  }

  async purchasePackage(packageToPurchase: PurchasePackage): Promise<CustomerInfo> {
    await this.ensureInitialized();
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    } catch (error) {
      console.error('Failed to purchase package:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    await this.ensureInitialized();
    try {
      return await Purchases.restorePurchases();
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    await this.ensureInitialized();
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('Failed to get customer info:', error);
      throw error;
    }
  }

  async identifyUser(userId: string): Promise<void> {
    await this.ensureInitialized();
    if (!isPurchasesSupported()) return;
    try {
      await Purchases.logIn(userId);
    } catch (error) {
      console.error('Failed to identify user:', error);
      throw error;
    }
  }

  async resetUser(): Promise<void> {
    await this.ensureInitialized();
    if (!isPurchasesSupported()) return;
    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('Failed to reset user:', error);
      throw error;
    }
  }

  async showOfferings(): Promise<PurchasesOffering | null> {
    return this.getOfferings();
  }

  /**
   * Present the RevenueCat paywall. Does not require sign-in.
   * Returns true only when the named premium entitlement is active afterwards.
   */
  async presentPaywall(offering?: PurchasesOffering | null): Promise<{
    result: PAYWALL_RESULT;
    customerInfo: CustomerInfo | null;
    isPremium: boolean;
  }> {
    await this.ensureInitialized();
    const currentOffering = offering || (await this.getOfferings());
    if (!currentOffering) {
      throw new Error('No offerings available');
    }

    const result = await RevenueCatUI.presentPaywall({
      offering: currentOffering,
      displayCloseButton: true,
    });

    let customerInfo: CustomerInfo | null = null;
    try {
      customerInfo = await this.getCustomerInfo();
    } catch {
      customerInfo = null;
    }

    return {
      result,
      customerInfo,
      isPremium: hasPremiumEntitlement(customerInfo),
    };
  }

  async showPaywall(): Promise<void> {
    await this.presentPaywall();
  }

  async openManageSubscriptions(customerInfo?: CustomerInfo | null): Promise<void> {
    await this.ensureInitialized();

    const managementURL = customerInfo?.managementURL;
    if (managementURL) {
      await Linking.openURL(managementURL);
      return;
    }

    if (Platform.OS === 'ios' && typeof (Purchases as { showManageSubscriptions?: () => Promise<void> }).showManageSubscriptions === 'function') {
      await (Purchases as { showManageSubscriptions: () => Promise<void> }).showManageSubscriptions();
      return;
    }

    if (Platform.OS === 'android') {
      await Linking.openURL('https://play.google.com/store/account/subscriptions');
      return;
    }

    throw new Error('Subscription management is unavailable on this device');
  }
}

export const revenueCatService = RevenueCatService.getInstance();
