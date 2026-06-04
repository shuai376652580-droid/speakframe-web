import { onRequest } from "firebase-functions/v2/https";
import app from "./server/index.js";

export const api = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  app
);
