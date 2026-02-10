# Firebase Storage CORS Error Fix

## Problem
You're getting a CORS error when uploading images to Firebase Storage from localhost:
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' from origin 'http://localhost:1231' has been blocked by CORS policy
```

## Root Cause
Firebase Storage has strict CORS policies that need to be configured to allow uploads from your development environment.

## Solutions (Choose One)

### Solution 1: Configure Firebase Storage CORS Rules (RECOMMENDED)

This is the proper production-ready solution.

#### Step 1: Install Google Cloud SDK
Download and install from: https://cloud.google.com/sdk/docs/install

#### Step 2: Authenticate
```bash
gcloud auth login
```

#### Step 3: Create cors.json file
Create a file named `cors.json` in your project root:

```json
[
  {
    "origin": ["http://localhost:1231", "http://localhost:8100", "https://pegasus-2be94.firebaseapp.com"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

#### Step 4: Apply CORS configuration
```bash
gsutil cors set cors.json gs://pegasus-2be94.appspot.com
```

#### Step 5: Verify CORS configuration
```bash
gsutil cors get gs://pegasus-2be94.appspot.com
```

---

### Solution 2: Update Firebase Storage Security Rules

Go to Firebase Console → Storage → Rules and update:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /avatars/{userId}_{timestamp} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

### Solution 3: Use Firebase Storage Emulator for Development

For local development, use the Firebase emulator:

#### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

#### Step 2: Initialize Firebase emulators
```bash
firebase init emulators
```
Select "Storage" when prompted.

#### Step 3: Update environment.ts
Add to your environment configuration:
```typescript
useEmulators: true
```

#### Step 4: Update your app module
In your app initialization, add:
```typescript
import { connectStorageEmulator } from '@angular/fire/storage';

// In your initialization
if (environment.useEmulators) {
  connectStorageEmulator(storage, 'localhost', 9199);
}
```

---

## Code Changes Already Applied

I've updated your `uploadImage` method in `avatar.service.ts` to:
1. Add proper content type headers
2. Use unique filenames with timestamps
3. Update the correct Firestore collection (Drivers instead of Riders)
4. Better error handling

---

## Quick Test

After applying CORS rules, test with:

```typescript
// In your browser console
fetch('https://firebasestorage.googleapis.com/v0/b/pegasus-2be94.appspot.com/o/avatars%2Ftest', {
  method: 'OPTIONS'
}).then(r => console.log('CORS OK:', r.status))
```

---

## Additional Notes

1. **For Production**: Make sure to update the `origin` in cors.json to include your production domain
2. **Security**: The current rules allow authenticated users to upload only to their own avatar path
3. **File Size**: Consider adding file size limits in your upload logic
4. **Image Optimization**: Consider compressing images before upload to reduce storage costs

---

## Troubleshooting

If CORS errors persist:

1. Clear browser cache and hard reload (Ctrl+Shift+R)
2. Check Firebase Console → Storage → Files to verify uploads are working
3. Verify your Firebase project ID matches in environment.ts
4. Check browser console for detailed error messages
5. Ensure you're authenticated before uploading
