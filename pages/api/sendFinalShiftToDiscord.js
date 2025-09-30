import FormData from "form-data";
import fetch from "node-fetch";
import { callFirebaseFunction, isFirebaseFunctionsEnabled } from "../../lib/firebaseFunctionsClient";
import { getFirestore } from "../../lib/firebaseAdmin";
import { sendFinalShiftToDiscord as runSendFinalShiftToDiscord } from "../../backend/sendFinalShiftToDiscord.js";

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

  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    month < 1 ||
    month > 12
  ) {
    res.status(400).json({ error: "Invalid year or month" });
    return;
  }

  if (shouldUseCloudFunctions()) {
    try {
      const { response, data } = await callFirebaseFunction({
        name: "sendFinalShiftToDiscord",
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
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("DISCORD_WEBHOOK_URLが未設定です");
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
    if (error.code === "NOT_FOUND") {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
