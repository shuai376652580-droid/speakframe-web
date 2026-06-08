import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import admin from "firebase-admin";
import { decryptSecret } from "./secrets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "speakframe-db.json");

const DEFAULT_DB = {
  assets: [],
  updatedAt: null,
};

let firestoreDb = null;

function getFirebasePrivateKey() {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!rawKey) return "";

  const decrypted = decryptSecret(rawKey);
  return decrypted.replace(/\\n/g, "\n");
}

function getFirestore() {
  if (firestoreDb) return firestoreDb;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  firestoreDb = admin.firestore();
  return firestoreDb;
}

function getUserDocRef() {
  const db = getFirestore();

  if (!db) return null;

  const collectionName = process.env.FIREBASE_COLLECTION || "speakframe_users";
  const documentId = process.env.FIREBASE_USER_ID || "local-user";

  return db.collection(collectionName).doc(documentId);
}

function getAssetDocId(asset) {
  const id = typeof asset?.id === "string" && asset.id.trim() ? asset.id.trim() : crypto.randomUUID();
  return encodeURIComponent(id);
}

function sortAssets(assets) {
  return [...assets].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || "") || 0;
    const bTime = Date.parse(b?.createdAt || "") || 0;
    return bTime - aTime;
  });
}

async function commitInChunks(db, operations) {
  const chunkSize = 450;

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = db.batch();
    const chunk = operations.slice(index, index + chunkSize);

    chunk.forEach((operation) => {
      if (operation.type === "set") {
        batch.set(operation.ref, operation.data, operation.options || {});
      } else if (operation.type === "delete") {
        batch.delete(operation.ref);
      }
    });

    await batch.commit();
  }
}

async function ensureDbFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

async function readLocalDb() {
  await ensureDbFile();

  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const data = JSON.parse(raw);

    return {
      ...DEFAULT_DB,
      ...data,
      assets: Array.isArray(data.assets) ? data.assets : [],
    };
  } catch (err) {
    console.error("readLocalDb error:", err);
    return { ...DEFAULT_DB };
  }
}

async function writeLocalDb(nextDb) {
  await ensureDbFile();

  const safeDb = {
    ...DEFAULT_DB,
    ...nextDb,
    assets: Array.isArray(nextDb?.assets) ? nextDb.assets : [],
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(DB_PATH, JSON.stringify(safeDb, null, 2), "utf8");
  return safeDb;
}

export async function readDb() {
  try {
    const docRef = getUserDocRef();

    if (!docRef) {
      return readLocalDb();
    }

    const snapshot = await docRef.get();
    const assetSnapshot = await docRef.collection("assets").get();
    const subcollectionAssets = assetSnapshot.docs.map((doc) => doc.data()).filter(Boolean);

    if (subcollectionAssets.length > 0) {
      const data = snapshot.exists ? snapshot.data() || {} : {};

      return {
        ...DEFAULT_DB,
        ...data,
        assets: sortAssets(subcollectionAssets),
      };
    }

    if (!snapshot.exists) {
      return { ...DEFAULT_DB };
    }

    const data = snapshot.data() || {};

    return {
      ...DEFAULT_DB,
      ...data,
      assets: Array.isArray(data.assets) ? data.assets : [],
    };
  } catch (err) {
    console.error("readFirestoreDb error:", err);
    return readLocalDb();
  }
}

export async function writeDb(nextDb) {
  const updatedAt = new Date().toISOString();
  const safeDb = {
    ...DEFAULT_DB,
    ...nextDb,
    assets: Array.isArray(nextDb?.assets) ? nextDb.assets : [],
    updatedAt,
  };
  try {
    const docRef = getUserDocRef();

    if (!docRef) {
      return writeLocalDb(safeDb);
    }

    const db = getFirestore();
    const assetsRef = docRef.collection("assets");
    const existingSnapshot = await assetsRef.get();
    const nextAssets = safeDb.assets.map((asset) => ({
      ...asset,
      id: typeof asset?.id === "string" && asset.id.trim() ? asset.id.trim() : crypto.randomUUID(),
    }));
    const nextDocIds = new Set(nextAssets.map((asset) => getAssetDocId(asset)));
    const operations = [];

    operations.push({
      type: "set",
      ref: docRef,
      data: {
        updatedAt,
        assetCount: nextAssets.length,
        storageMode: "asset-subcollection",
        assets: admin.firestore.FieldValue.delete(),
      },
      options: { merge: true },
    });

    nextAssets.forEach((asset) => {
      operations.push({
        type: "set",
        ref: assetsRef.doc(getAssetDocId(asset)),
        data: asset,
        options: { merge: true },
      });
    });

    existingSnapshot.docs.forEach((doc) => {
      if (!nextDocIds.has(doc.id)) {
        operations.push({
          type: "delete",
          ref: doc.ref,
        });
      }
    });

    await commitInChunks(db, operations);
    await writeLocalDb(safeDb);
    return {
      ...safeDb,
      assets: nextAssets,
    };
  } catch (err) {
    console.error("writeFirestoreDb error:", err);

    if (getUserDocRef()) {
      throw err;
    }

    return writeLocalDb(safeDb);
  }
}

export async function getDbStatus() {
  const configured = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
  try {
    const docRef = getUserDocRef();

    if (!docRef) {
      return {
        configured,
        provider: "local-json",
        collection: null,
        documentId: null,
        ok: true,
      };
    }

    const snapshot = await docRef.get();
    const assetSnapshot = await docRef.collection("assets").limit(1).get();

    return {
      configured,
      provider: "firestore",
      collection: process.env.FIREBASE_COLLECTION || "speakframe_users",
      documentId: process.env.FIREBASE_USER_ID || "local-user",
      storageMode: assetSnapshot.empty && snapshot.exists ? "legacy-single-document" : "asset-subcollection",
      ok: true,
    };
  } catch (err) {
    return {
      configured,
      provider: "local-json",
      collection: process.env.FIREBASE_COLLECTION || "speakframe_users",
      documentId: process.env.FIREBASE_USER_ID || "local-user",
      ok: false,
      error: err?.message || "Firestore connection failed",
    };
  }
}
