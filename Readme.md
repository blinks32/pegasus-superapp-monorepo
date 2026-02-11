# Pegasus SuperApp Monorepo

Welcome to the **Pegasus SuperApp Monorepo**. This project contains a comprehensive ride-sharing ecosystem, including mobile applications for Riders and Drivers, a powerful Administration Dashboard, and a dedicated Payment Server.

Built with **Ionic Framework**, **Angular**, and **Capacitor**, this monorepo is designed for scalability and ease of deployment.

---

## 🏗 Project Structure

- **Rider App** (`/Rider`): Mobile application for users to book rides.
- **Driver App** (`/Driver`): Mobile application for drivers to accept and manage trips.
- **Admin Dashboard** (`/Admin`): Web-based portal for system administrators to manage users, rides, and settings.
- **Payment Server** (`/PaymentServer`): Node.js server handling Stripe, Paystack, and other payment integrations.
- **Config** (`/config`): Centralized configuration for all applications.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.x or later recommended)
- **npm** (comes with Node.js)
- **Ionic CLI**: `npm install -g @ionic/cli`
- **Native SDKs** (for mobile development):
  - **Android Studio** for Android builds.
  - **Xcode** (macOS only) for iOS builds.

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd IONIC
```

### 2. Install Dependencies

You need to install dependencies for the root and each sub-project:

```bash
# Install root dependencies
npm install

# Install sub-project dependencies
cd Rider && npm install && cd ..
cd Driver && npm install && cd ..
cd Admin && npm install && cd ..
cd PaymentServer && npm install && cd ..
```

### 3. Configure the Apps

Follow the **[Configuration Guide](#app-configuration-guide)** below to set up your Firebase, Google Maps, and payment keys in `config/app-config.json`.

### 4. Sync Configurations

Once your `app-config.json` is ready, run the sync script to propagate these settings to all applications:

```bash
npm run sync
```

---

## 💻 Running the Applications

From the root directory, you can start each application using the following commands:

| Application | Command | Default URL |
|-------------|---------|-------------|
| **Rider App** | `npm run start:rider` | http://localhost:8100 |
| **Driver App** | `npm run start:driver` | http://localhost:4200 |
| **Admin Dashboard** | `npm run start:admin` | http://localhost:4201* |
| **Payment Server** | `npm run start:server` | http://localhost:3000 |

*\*Note: Admin app will default to 4200 but will prompt for another port if Driver is already running. You can specify a port using `ng serve --port 4201`.*

---

# ⚙️ App Configuration Guide

This guide walks you through setting up all the required API keys and configurations for your ride-sharing app.

## Quick Start

1. Open `config/app-config.json`
2. Replace the placeholder values with your actual API keys
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

| Maps not loading | Check API key restrictions and enabled APIs |
| Auth not working | Verify Firebase Auth providers are enabled |
| **"Permission Denied"** | This common error happens when Firestore Security Rules are not configured. See the **[Firestore Security Rules](#firestore-security-rules)** section below. |
| Push notifications failing | Check platform certificates (APNs for iOS) |
| Payments failing | Ensure payment server URL is correct and accessible |

---

## 🌍 Multi-Language Support

The ecosystem supports multiple languages out of the box:
- **English (Default)**: Used as the primary language and fallback for missing keys.
- **Malay (Bahasa Melayu)**: Full translation support for Rider, Driver, and Admin apps.

### How to add a new language:
1. Create a JSON file (e.g., `fr.json`) in the `assets/i18n/` directory of the desired app.
2. Add the language key to the `TranslateModule` configuration in `app.module.ts`.

---

## 🔒 Firestore Security Rules

When setting up a new Firebase project, your app will fail with **"Missing or insufficient permissions"** unless you deploy the correct Security Rules. 

Navigate to **Firebase Console > Firestore Database > Rules** and use this boilerplate:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rider Profiles
    match /Riders/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Driver Profiles
    match /Drivers/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Ride Requests
    match /Request/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // Admin Access
    match /Admins/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public Collections (e.g. App Config, Blog)
    match /Blogs/{blogId} {
      allow read: if true;
    }
  }
}
```

---

## 🔄 Configuration Synchronization

This monorepo uses a **centralized configuration system**. 

1. **NEVER** edit `environment.ts` files directly in sub-projects.
2. **ALWAYS** edit `config/app-config.json`.
3. After every change, run:
   ```bash
   npm run sync
   ```
This ensures your Firebase keys, Payment URLs, and Google Maps keys are perfectly synced across all platforms (Web, Android, iOS, and Backend).

## Need Help?

Contact: chndth@gmail.com
