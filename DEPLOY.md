# SpeakFrame Deployment

The simplest deployment is one Node web service.

Express serves:

- API routes under `/api`
- the built Vite frontend from `dist`

## Build and Start

```bash
npm install
npm run build
npm start
```

## Required Environment Variables

Set these in your deployment platform. Do not upload `.env`.

```env
NODE_ENV=production
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

The platform provides `PORT`; you usually do not need to set it manually.

## Render

1. Push this project to GitHub.
2. In Render, create a new Blueprint or Web Service.
3. Use:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add the environment variables above.
5. Deploy.

## Mobile Use

After deployment, use the HTTPS URL on your phone.

Microphone features require HTTPS and browser support. Android Chrome/Edge usually work better than iOS Safari.
