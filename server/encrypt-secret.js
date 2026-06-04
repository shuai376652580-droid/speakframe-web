import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

function printGeneratedMasterKey() {
  const generatedKey = crypto.randomBytes(32).toString("base64");

  console.log("Add this line to .env:");
  console.log(`MASTER_KEY=${generatedKey}`);
}

function getMasterKeyBytes() {
  if (!process.env.MASTER_KEY || process.env.MASTER_KEY.startsWith("replace_with")) {
    printGeneratedMasterKey();
    console.log("");
    console.log("Then run this command again with your API key:");
    console.log("npm run encrypt:key -- your_api_key_here");
    process.exit(0);
  }

  const key = Buffer.from(process.env.MASTER_KEY, "base64");

  if (key.length !== 32) {
    throw new Error("MASTER_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

if (process.argv.includes("--new-master")) {
  printGeneratedMasterKey();
  process.exit(0);
}

function getSecretFromArgs() {
  const envIndex = process.argv.indexOf("--env");

  if (envIndex !== -1) {
    const envName = process.argv[envIndex + 1];

    if (!envName) {
      console.log("Usage:");
      console.log("npm run encrypt:key -- --env ENV_VAR_NAME");
      process.exit(1);
    }

    return process.env[envName] || "";
  }

  const rawArg = process.argv.slice(2).join(" ").trim();

  if (process.argv.length === 3 && process.env[rawArg]) {
    return process.env[rawArg];
  }

  return rawArg;
}

const secret = getSecretFromArgs();

if (!secret) {
  console.log("Usage:");
  console.log("npm run encrypt:key -- your_api_key_here");
  console.log("npm run encrypt:key -- --env ENV_VAR_NAME");
  process.exit(1);
}

const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKeyBytes(), iv);
const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const payload = {
  iv: iv.toString("base64"),
  tag: tag.toString("base64"),
  ciphertext: ciphertext.toString("base64"),
};

console.log(`ENC:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`);
