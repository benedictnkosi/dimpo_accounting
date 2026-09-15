# RevenueCat webhooks (backend, outside this app)

Secure server-side synchronization of subscription status is **not implemented in this repository**. As a result, premium lesson documents are UI-gated but remain publicly readable from Firestore.

To protect raw premium lesson content or maintain an admin mirror of Pro status:

1. Create a trusted backend endpoint (Cloud Function, API server, etc.).
2. Configure a RevenueCat webhook pointing at that endpoint.
3. Verify the RevenueCat authorization header / shared secret on every request.
4. Map `app_user_id` to your Firebase UID (after identity aliasing).
5. Update only entitlement fields such as `premium` and `premiumUpdatedAt` from the backend service account.
6. Never allow the mobile client to write those fields (`firestore.rules` already blocks them).

Until that backend exists, treat RevenueCat customer info on the device as the only in-app access source of truth, and do not claim that Level 3-4 documents are server-enforced.
