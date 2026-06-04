# Firebase Firestore Setup

This project uses Firebase only on the Express server. The frontend does not expose Firebase keys.

## 1. Create Firestore

1. Open Firebase Console.
2. Create or choose a Firebase project.
3. Go to Firestore Database.
4. Create a database.
5. Choose a location.

## 2. Create a Service Account Key

1. Go to Project settings.
2. Open Service accounts.
3. Click Generate new private key.
4. Download the JSON file.

Do not put this JSON file in git.

## 3. Fill `.env`

From the downloaded JSON:

```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=your_private_key_or_encrypted_private_key
FIREBASE_COLLECTION=speakframe_users
FIREBASE_USER_ID=local-user
```

For `FIREBASE_PRIVATE_KEY`, copy the `private_key` value from the JSON. Keep `\n` as text.

Example:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Encrypted example:

```powershell
npm run encrypt:key -- "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Copy the printed `ENC:...` value into:

```env
FIREBASE_PRIVATE_KEY=ENC:...
```

## 4. Restart the server

After changing `.env`, restart:

```powershell
npm run dev
```

If Firebase config is blank or invalid, the app falls back to local JSON storage at:

```text
server/data/speakframe-db.json
```
