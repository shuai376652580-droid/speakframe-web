import crypto from "crypto";

const ENCRYPTED_PREFIX = "ENC:";

function getMasterKeyBytes() {
  const rawKey = process.env.MASTER_KEY;

  if (!rawKey) {
    throw new Error("MASTER_KEY is required to decrypt encrypted API keys.");
  }

  const key = Buffer.from(rawKey, "base64");

  if (key.length !== 32) {
    throw new Error("MASTER_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

export function decryptSecret(value) {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const payload = JSON.parse(Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64").toString("utf8"));
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getMasterKeyBytes(),
    Buffer.from(payload.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value) {
  if (!value) return "";
  if (value.startsWith(ENCRYPTED_PREFIX)) return "ENC:***";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
