# RevenueCat Setup Guide

This guide matches the Free vs Pro implementation in the Accounting CPA Quiz app.

## Source of truth

- **Client access** is determined only by RevenueCat customer info.
- The named entitlement identifier is **`pro`** (`PREMIUM_ENTITLEMENT_ID` in `services/revenueCat.ts`).
- Do **not** grant Pro from a Firestore `premium` boolean. Clients cannot write entitlement fields (`firestore.rules`).
- Cached RevenueCat customer info is used for brief offline sessions; entitlement updates arrive via customer-info listeners and app-foreground refresh.

## Prerequisites

1. RevenueCat account: [revenuecat.com](https://revenuecat.com)
2. App Store Connect (iOS)
3. Google Play Console (Android)

## Dashboard configuration

### 1. Apps

| Platform | Bundle / application ID |
| --- | --- |
| iOS | `com.dimpoaccounting` |
| Android | `com.accountingtutor` |

API keys live in `services/revenueCat.ts` (authoritative). `config/revenueCat.ts` re-exports that module.

Use the **Dimpo Accounting** RevenueCat project keys only. Do not paste keys from exam-quiz / Dimpo Learning — that makes the paywall show the wrong app name and products.

### 2. Entitlement (required)

1. Open **Entitlements**
2. Use entitlement identifier: **`pro`**
3. Attach every Pro subscription product to this entitlement

The app checks **only** `entitlements.active.pro`. Any other entitlement does not unlock Pro.

### 3. Products

Use the subscription products already configured in App Store Connect:

| Identifier | Type |
| --- | --- |
| `dimpo_accounting_monthly` | Auto-renewing subscription |
| `dimpo_accounting_annual` | Auto-renewing subscription |

Optional legacy / non-subscription SKUs may exist in stores, but Pro access still requires the `pro` entitlement to be active.

Mirror the same product IDs in:

- App Store Connect → In-App Purchases / Subscriptions
- Google Play Console → Monetize → Subscriptions

**Do not hardcode prices in the React Native UI.** Package prices come from RevenueCat (`product.priceString`).

### 4. Offering

1. Create a **Default** offering
2. Add the monthly / yearly packages
3. Mark the offering as **Current**

### 5. Restore & management

- **Restore Purchases** calls `Purchases.restorePurchases()` and confirms `premium` is active
- **Manage Subscription** opens `customerInfo.managementURL` when available, otherwise the platform subscriptions page / `showManageSubscriptions` on iOS

## Free vs Pro product split

### Free

- Level 1: Basics — up to **15 questions per subtopic**
- Level 2: Core Practice — **3 completed** accounting questions total across the learner lifetime
- Step-by-step practice — **3 completed** questions per local calendar day
- Basic correctness feedback
- Topic mastery, streaks, ordinary progress
- Cloud progress sync after sign-in
- Visible preview of locked Levels 3 and 4

### Pro

- Unlimited Levels 1 and 2
- Full Level 3 Application and Level 4 Challenge
- Unlimited step-by-step practice
- Worked explanations already present in question data
- Weak-topic insights from attempt statistics
- Pro badge + Manage Subscription / Restore Purchases

Practice daily usage is stored in `progress.dailyUsage` and merged with cloud progress. Level 2 uses lifetime completed-question history instead of a daily allowance.

## Anonymous purchases

Sign-in is **not** required to purchase. RevenueCat anonymous IDs are preserved until the user signs in, then `Purchases.logIn(uid)` aliases the accounts.

## Server-side protection (required to secure raw premium content)

The app currently enforces the Free/Pro split in its UI, but the `accounting` collection remains publicly readable so signed-out learners can use the curriculum. UI gating prevents ordinary access; it does not prevent someone from downloading Level 3-4 documents directly from Firestore.

To enforce premium access at the data layer without breaking anonymous purchases, add a trusted backend that validates RevenueCat access and returns premium lesson content. If signed-in-only premium access is acceptable, a RevenueCat webhook can instead maintain a server-owned entitlement mirror used by Firestore rules:

1. Configure a **RevenueCat webhook** to a trusted backend
2. Verify the webhook secret server-side
3. Update only `users/{uid}.premium` / `premiumUpdatedAt` from that backend

The mobile client must never write those fields. Do not tighten the current `accounting` read rule until the app query model and anonymous-purchase flow have been migrated, or free and anonymous paying learners will lose access.

## Development tips

1. Prefer a physical device / StoreKit testing for purchase flows
2. Confirm the Default offering is **Current** and products are attached to entitlement `pro`
3. If the app logs `No offerings available`, RevenueCat has no Current offering (or store products failed to load) — fix the dashboard before debugging app code
4. Watch console logs for RevenueCat initialization errors

## Testing checklist

- [ ] RevenueCat initializes without errors
- [ ] Offerings load with localized prices
- [ ] Purchase activates `pro` entitlement
- [ ] Restore Purchases works for PURCHASED and RESTORED outcomes
- [ ] Expired / cancelled / refunded subscriptions remove Pro when entitlement is inactive
- [ ] Levels 3–4 stay locked for free users (no `accessGranted` URL bypass)
- [ ] Free Level 1 shows up to 15 questions per subtopic
- [ ] Free Level 2 locks after 3 completed questions total and does not reset daily
- [ ] Free practice daily limit resets at local midnight
- [ ] Profile shows Upgrade / Restore for free users and Manage / Restore for Pro

## Support

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [RevenueCat Community](https://community.revenuecat.com/)
