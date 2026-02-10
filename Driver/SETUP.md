# Project Setup Documentation

This guide provides step-by-step instructions to set up, build, and run the **Driver App** project for Web, Android, and iOS.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js**: (Recommended version: LTS, e.g., v16 or v18). Verify with `node -v`.
- **NPM**: Included with Node.js. Verify with `npm -v`.
- **Ionic CLI**: Install globally using `npm install -g @ionic/cli`.
- **Git**: For version control.

### Platform Specific Requirements

- **Android**:
  - **Android Studio**: For building and running the Android app.
  - **Java JDK**: 11 or 17 (Verify with `java -version`).
  - **Android SDK**: Install via Android Studio.

- **iOS**:
  - **macOS**: Required for iOS development.
  - **Xcode**: Install via the Mac App Store.
  - **CocoaPods**: Install via `sudo gem install cocoapods` (if needed, though Capacitor may handle dependencies).

---

## 1. Installation

Clone the repository and install the project dependencies.

```bash
# Clone the repository (if you haven't already)
# git clone <repo-url>
# cd <project-folder>

# Install Dependencies
npm install
```

---

## 2. Web Setup

To run the application in your browser for development:

```bash
# Run the development server
npm start
# OR
ionic serve
```

- The app will be accessible at `http://localhost:4200`.
- The page will automatically reload if you change any of the source files.

---

## 3. Android Setup

To build and run the application on an Android device or emulator:

### Initial Setup

If the `android` folder does not exist:

```bash
# Add the Android platform
ionic cap add android
```

### Sync & Build

Every time you make changes to the web code (in `src`), you need to build the web assets and sync them to the native project.

```bash
# Build web assets and sync to Android
ionic cap sync android
```

### Run on Device/Emulator

```bash
# Open the project in Android Studio
ionic cap open android
```

1.  Android Studio will open.
2.  Wait for the Gradle sync to finish.
3.  Select your connected device or an emulator.
4.  Click the **Run** button (green play icon).

**Note:** Ensure your `capacitor.config.ts` is configured correctly. The current `appId` is `com.pegasus.driver`.

---

## 4. iOS Setup

To build and run the application on an iOS Simulator or Device:

### Initial Setup

If the `ios` folder does not exist:

```bash
# Add the iOS platform
ionic cap add ios
```

### Sync & Build

Every time you make changes to the web code, build and sync:

```bash
# Build web assets and sync to iOS
ionic cap sync ios
```

### Run on Simulator/Device

```bash
# Open the project in Xcode
ionic cap open ios
```

1.  Xcode will open.
2.  Select your target device (Simulator or connected iPhone).
3.  Click the **Run** button (play icon).

**Note:** You may need to sign in with your Apple ID in Xcode to provision a valid provisioning profile for physical devices.

---

## Troubleshooting

### CORS Issues
If you encounter CORS errors during development (connecting to backend APIs), refer to the included `CORS_FIX_INSTRUCTIONS.md` or `setup-cors-manual.md` files in the project root.

### Build Errors
- If `npm install` fails, try deleting `node_modules` and `package-lock.json`, then run `npm install` again.
- If Android build fails, ensure your Android SDK packages are up to date in Android Studio.

### Capacitor Issues
If native plugins are not working, try:
```bash
ionic cap sync
```
This updates the native configurations and plugins.
