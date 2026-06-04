# Deploy to Firebase

This project deploys to Firebase as:

- Firebase Hosting: serves `dist`
- Cloud Functions: serves Express API as `api`

## 1. Install Firebase CLI

```powershell
npm install -g firebase-tools
firebase login
```

## 2. Build

```powershell
npm run build
```

## 3. Configure Function Environment

For local development, `.env` is used.

For deployed Functions, set the same environment variables in Firebase/Google Cloud.

Required:

```env
MASTER_KEY=
TEXT_BASE_URL=https://api.deepseek.com
TEXT_API_KEY=ENC:...
TEXT_MODEL=deepseek-v4-flash
GEMINI_API_KEY=ENC:...
VIDEO_MODEL=gemini-2.5-flash-lite
FIREBASE_PROJECT_ID=english-27591
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@english-27591.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=ENC:...
FIREBASE_COLLECTION=speakframe_users
FIREBASE_USER_ID=105823717329637663310
```

The fastest testing path is to use Firebase Functions environment files. Before deploying, create a local `.env` copy for Firebase deploy only if you are comfortable with Firebase CLI loading it, or configure variables in Google Cloud Run/Functions environment settings after the first deploy.

Do not commit `.env`.

## 4. Deploy

```powershell
firebase deploy
```

After deploy, Firebase prints a Hosting URL:

```text
https://english-27591.web.app
```

Test:

```powershell
Invoke-RestMethod https://english-27591.web.app/api/db-status
```

Expected:

```json
{
  "provider": "firestore",
  "ok": true
}
```

## Notes

Microphone features require HTTPS. Firebase Hosting provides HTTPS.
