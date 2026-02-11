# Ride App Configuration Guide

This guide walks you through setting up all the required API keys and configurations for your ride-sharing app.

## Quick Start

1. Open `config/app-config.json`
2. Replace the placeholder values with your actual API keys
// turbo
3. From the root directory, run: `npm run sync`
4. The apps (Driver, Rider, Admin, and PaymentServer) will automatically be updated with these values

---

## Firebase Setup

**Where to get:** [Firebase Console](https://console.firebase.google.com/)

1. Create a new Firebase project (or use existing)
2. Go to **Project Settings** (gear icon) > **General**
3. Scroll to "Your apps" and click **Add app** > Web
4. Copy the config values:

```json
"firebase": {
  "apiKey": "AIzaSy...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project",
  "storageBucket": "your-project.firebasestorage.app",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc123"
}
```

**Required Firebase Services:**
- Authentication (Email/Password, Phone)
- Firestore Database
- Storage

---

## Google Maps Setup

**Where to get:** [Google Cloud Console](https://console.cloud.google.com/)

1. Create or select a project
2. Go to **APIs & Services** > **Library**
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps JavaScript API
   - Places API
   - Directions API
   - Geocoding API
4. Go to **Credentials** > **Create Credentials** > **API Key**
5. (Recommended) Restrict the key to your app's package name

```json
"googleMaps": {
  "apiKey": "AIzaSy..."
}
```

---

## Push Notifications

Choose ONE of these options:

### Option A: OneSignal (Recommended)

**Where to get:** [OneSignal Dashboard](https://onesignal.com/)

1. Create a new app in OneSignal
2. Configure platforms (Android/iOS)
3. Go to **Settings** > **Keys & IDs**

```json
"onesignal": {
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "restApiKey": "your-rest-api-key",
  "androidChannelId": ""
}
```

### Option B: Firebase Cloud Messaging (FCM)

1. In Firebase Console, go to **Project Settings** > **Cloud Messaging**
2. Copy the Server Key and Sender ID

```json
"fcm": {
  "serverKey": "AAAA...",
  "senderId": "123456789"
}
```

---

## Payment Server

**Where to get:** [Stripe Dashboard](https://dashboard.stripe.com/)

1. Deploy the PaymentServer to Vercel or your hosting
2. Get your Stripe Publishable Key from **Developers** > **API Keys**

```json
"payment": {
  "serverUrl": "https://your-payment-server.vercel.app/",
  "stripePublishableKey": "pk_test_..."
}
```

---

## App Settings

Customize your app's basic info:

```json
"app": {
  "name": "My Ride App",
  "defaultCurrency": "USD",
  "defaultCountryCode": "US",
  "supportEmail": "support@yourapp.com",
  "supportPhone": "+1234567890"
}
```

---

## Default Login (Testing Mode)

For development and testing, you can configure default login credentials that auto-fill the login form. This is useful for:
- Quick testing without entering credentials manually
- Demo purposes
- Development workflow

### Configuration in app-config.json

```json
"defaultLogin": {
  "rider": {
    "enabled": true,
    "countryCode": "+60",
    "phoneNumber": "1234567890",
    "otp": "123456"
  },
  "driver": {
    "enabled": true,
    "countryCode": "+60",
    "phoneNumber": "1234567891",
    "otp": "123456"
  },
  "admin": {
    "enabled": true,
    "countryCode": "+60",
    "phoneNumber": "1234567892",
    "otp": "123456"
  }
}
```

### Configuration in Environment Files

Each app also has its own `defaultLogin` config in `src/environments/environment.ts`:

```typescript
defaultLogin: {
  enabled: false,        // Set to true to enable auto-fill
  countryCode: '+60',    // Country dial code
  phoneNumber: '1234567890',  // Phone number (without country code)
  otp: '123456'          // OTP code for verification
}
```

### How It Works

1. When `enabled: true`, the login form auto-fills with the configured phone number
2. The OTP is stored in localStorage for the OTP verification modal
3. The country code and flag are automatically set

### Security Warning

⚠️ **IMPORTANT:** Always set `enabled: false` in production builds! Default login credentials should only be used during development and testing.

---

## Verification Checklist

- [ ] Firebase: Auth, Firestore, and Storage enabled
- [ ] Google Maps: All required APIs enabled
- [ ] Push notifications: OneSignal OR FCM configured
- [ ] Payment server: Deployed and Stripe key added
- [ ] App settings: Customized for your brand

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Maps not loading | Check API key restrictions and enabled APIs |
| Auth not working | Verify Firebase Auth providers are enabled |
| Push notifications failing | Check platform certificates (APNs for iOS) |
| Payments failing | Ensure payment server URL is correct and accessible |

## Need Help?

Contact: support@example.com
