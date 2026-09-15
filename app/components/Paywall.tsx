/**
 * Legacy mount-on-render paywall. Prefer `useRevenueCat().presentPaywall(source)`.
 * Kept as a thin wrapper so older call sites do not require sign-in just to purchase.
 */
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import React from 'react';

interface PaywallProps {
  onSuccess?: () => void;
  onClose?: () => void;
  source?: string;
}

export function Paywall({ onSuccess, onClose, source = 'legacy_paywall' }: PaywallProps) {
  const { presentPaywall } = useRevenueCat();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const unlocked = await presentPaywall(source);
      if (cancelled) return;
      if (unlocked) onSuccess?.();
      else onClose?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [onClose, onSuccess, presentPaywall, source]);

  return null;
}
