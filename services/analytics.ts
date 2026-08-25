import { Platform } from 'react-native';
import rnfbAnalytics, { firebase as rnfbFirebase } from '@react-native-firebase/analytics';

export type AnalyticsParamValue = string | number | boolean;
export type AnalyticsParams = Record<string, AnalyticsParamValue | null | undefined>;

type GaParams = Record<string, string | number>;
type NativeAnalytics = {
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
  logEvent: (name: string, params?: GaParams) => Promise<void>;
  setUserProperties: (properties: Record<string, string | null>) => Promise<void>;
};

function sanitizeEventName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
  return cleaned.slice(0, 40) || 'event';
}

function sanitizeParams(params?: Record<string, unknown>): GaParams | undefined {
  if (!params) return undefined;

  const properties: GaParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    const name = key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
    if (!name) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      properties[name] = value;
    } else if (typeof value === 'boolean') {
      properties[name] = value ? 1 : 0;
    } else {
      properties[name] = String(value).slice(0, 100);
    }
  }

  return Object.keys(properties).length ? properties : undefined;
}

function resolveAnalyticsFactory(): (() => NativeAnalytics) | null {
  const candidates = [
    rnfbAnalytics,
    (rnfbAnalytics as { default?: unknown })?.default,
    rnfbFirebase?.analytics,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return candidate as () => NativeAnalytics;
    }
  }
  return null;
}

class Analytics {
  private static instance: Analytics;
  private initialized = false;

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  private getNativeAnalytics(): NativeAnalytics | null {
    if (Platform.OS === 'web') return null;
    try {
      const factory = resolveAnalyticsFactory();
      if (!factory) return null;
      const instance = factory();
      if (!instance || typeof instance.logEvent !== 'function') return null;
      return instance;
    } catch (error) {
      console.warn('[GA] Native analytics unavailable:', error);
      return null;
    }
  }

  public async initialize(): Promise<void> {
    try {
      if (this.initialized) return;
      const nativeAnalytics = this.getNativeAnalytics();
      if (nativeAnalytics) {
        await nativeAnalytics.setAnalyticsCollectionEnabled(true);
      }
      this.initialized = true;
    } catch (error) {
      console.warn('[GA] Error initializing analytics:', error);
      this.initialized = true;
    }
  }

  public async identify(userId: string): Promise<void> {
    try {
      const nativeAnalytics = this.getNativeAnalytics();
      if (!nativeAnalytics) return;
      await nativeAnalytics.setUserId(userId);
    } catch (error) {
      console.warn('[GA] Error identifying user:', error);
    }
  }

  public async reset(): Promise<void> {
    try {
      const nativeAnalytics = this.getNativeAnalytics();
      if (!nativeAnalytics) return;
      await nativeAnalytics.setUserId(null);
    } catch (error) {
      console.warn('[GA] Error resetting user:', error);
    }
  }

  public async track(eventName: string, properties?: Record<string, unknown>): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      const nativeAnalytics = this.getNativeAnalytics();
      if (!nativeAnalytics) return;
      await nativeAnalytics.logEvent(sanitizeEventName(eventName), sanitizeParams(properties));
    } catch (error) {
      console.warn('[GA] Error tracking event:', error);
    }
  }

  public async setUserProperties(properties: Record<string, unknown>): Promise<void> {
    try {
      const nativeAnalytics = this.getNativeAnalytics();
      if (!nativeAnalytics) return;
      const userProperties: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(properties)) {
        const name = key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24);
        if (!name) continue;
        userProperties[name] = value == null ? null : String(value).slice(0, 36);
      }
      await nativeAnalytics.setUserProperties(userProperties);
    } catch (error) {
      console.warn('[GA] Error setting user properties:', error);
    }
  }
}

export const analytics = Analytics.getInstance();

export function logAnalyticsEvent(name: string, params?: AnalyticsParams): void {
  const properties: Record<string, AnalyticsParamValue> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      properties[key] = value;
    }
  }
  void analytics.track(name, properties);
}

export function setAnalyticsUserId(uid: string | null): void {
  if (uid) {
    void analytics.identify(uid);
  } else {
    void analytics.reset();
  }
}
