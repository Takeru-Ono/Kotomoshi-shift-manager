import { google } from "googleapis";
import { callFirebaseFunction, isFirebaseFunctionsEnabled } from "../../lib/firebaseFunctionsClient";
import { getFirestore } from "../../lib/firebaseAdmin";
import { sendFinalShiftToSheet as runSendFinalShiftToSheet } from "../../backend/sendFinalShiftToSheet.js";

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

function shouldUseCloudFunctions() {
  if (isFirebaseFunctionsEnabled()) return true;
  return process.env.USE_FIREBASE_FUNCTIONS === "true";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { year, month } = req.body;

  if (typeof year !== "number" || typeof month !== "number") {
    res.status(400).json({ error: "year and month must be numbers" });
    return;
  }

  if (shouldUseCloudFunctions()) {
    try {
      const { response, data } = await callFirebaseFunction({
        name: "sendFinalShiftToSheet",
        payload: { year, month },
      });
      const status = response.status;
      if (typeof data === "string") {
        res.status(status).send(data);
      } else {
        res.status(status).json(data);
      }
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to call Firebase Function" });
    }
    return;
  }

  try {
    const db = getFirestore();

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const privateKey = decodeGooglePrivateKey();

    if (!clientEmail || !privateKey || !spreadsheetId) {
      throw new Error("Missing Google Sheets credentials or spreadsheet ID");
    }

    const auth = new google.auth.JWT(clientEmail, undefined, privateKey, [
      "https://www.googleapis.com/auth/spreadsheets",
    ]);
    const sheetsClient = google.sheets({ version: "v4", auth });

    const result = await runSendFinalShiftToSheet({
      db,
      year,
      month,
      sheetsClient,
      spreadsheetId,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || "Firebase取得エラー" });
  }
}
