import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "./config.js";

const app = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId: config.firebaseProjectId,
});

export const firebaseAuth = getAuth(app);
