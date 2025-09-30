import cors from "cors";
import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { google } from "googleapis";
import fetch from "node-fetch";
import FormData from "form-data";
import {
  sendFinalShiftToSheet as runSendFinalShiftToSheet,
  sendFinalShiftToDiscord as runSendFinalShiftToDiscord,
} from "@shift-manager/backend";

const REGION = process.env.FIREBASE_FUNCTIONS_REGION || "asia-northeast1";
const SECRET_NAMES = [
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY_B64",
  "SPREADSHEET_ID",
  "DISCORD_WEBHOOK_URL",
];
const allowedOriginsEnv = process.env.FUNCTIONS_ALLOWED_ORIGINS || "";
const allowedOrigins = allowedOriginsEnv
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsHandler = cors({
  origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  methods: ["POST", "OPTIONS"],
});

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function applyCors(req, res) {
  return new Promise((resolve, reject) => {
    corsHandler(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function decodeGooglePrivateKey() {
  const base64 = process.env.GOOGLE_PRIVATE_KEY_B64;
  if (base64) {
    return Buffer.from(base64, "base64").toString("utf-8");
  }
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  if (raw) {
    return raw.replace(/\\n/g, "\n");
  }
  return null;
}

function parseYearMonth(body) {
  const year = Number(body?.year);
  const month = Number(body?.month);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    const err = new Error("year and month must be integers");
    err.status = 400;
    throw err;
  }
  if (month < 1 || month > 12) {
    const err = new Error("month must be between 1 and 12");
    err.status = 400;
    throw err;
  }
  return { year, month };
}

function createSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = decodeGooglePrivateKey();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    const err = new Error("Missing Google Sheets credentials or spreadsheet ID");
    err.status = 500;
    throw err;
  }

  const auth = new google.auth.JWT(clientEmail, undefined, privateKey, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  const sheetsClient = google.sheets({ version: "v4", auth });
  return { sheetsClient, spreadsheetId };
}

async function withCors(req, res, handler) {
  await applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  await handler(req, res);
}

function handleError(res, error) {
  console.error(error);
  const status = error.status || (error.code === "NOT_FOUND" ? 404 : 500);
  const message = error.message || "Internal Server Error";
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
}

export const sendFinalShiftToSheet = onRequest({ region: REGION, secrets: SECRET_NAMES }, async (req, res) => {
  await withCors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { year, month } = parseYearMonth(req.body);
      const { sheetsClient, spreadsheetId } = createSheetsClient();

      const result = await runSendFinalShiftToSheet({
        db,
        year,
        month,
        sheetsClient,
        spreadsheetId,
      });

      res.status(200).json(result);
    } catch (error) {
      handleError(res, error);
    }
  });
});

export const sendFinalShiftToDiscord = onRequest({ region: REGION, secrets: SECRET_NAMES }, async (req, res) => {
  await withCors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { year, month } = parseYearMonth(req.body);
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        const err = new Error("DISCORD_WEBHOOK_URL is not configured");
        err.status = 500;
        throw err;
      }

      const result = await runSendFinalShiftToDiscord({
        db,
        year,
        month,
        webhookUrl,
        FormDataCtor: FormData,
        fetchImpl: fetch,
      });

      res.status(200).json(result);
    } catch (error) {
      handleError(res, error);
    }
  });
});
