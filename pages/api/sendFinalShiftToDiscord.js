// pages/api/sendFinalShiftToDiscord.js

import admin from "firebase-admin";
import { generateShiftImage } from "../../lib/generateShiftImage";
import FormData from "form-data";
import fetch from "node-fetch";

export default async function handler(req, res) {
  const requestId = `${new Date().toISOString()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const log = (...args) => console.log(`[DiscordAPI][${requestId}]`, ...args);
  const logErr = (...args) => console.error(`[DiscordAPI][${requestId}]`, ...args);

  try {
    if (req.method !== "POST") {
      log("Invalid method:", req.method);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { year, month } = req.body || {};
    log("Request received", {
      year,
      month,
      ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      ua: req.headers["user-agent"],
    });

    if (
      typeof year !== "number" ||
      typeof month !== "number" ||
      month < 1 ||
      month > 12
    ) {
      log("Validation failed: year/month invalid");
      res.status(400).json({ error: "Invalid year or month" });
      return;
    }

    // Env presence (mask secrets)
    const hasB64Key = Boolean(process.env.FIREBASE_PRIVATE_KEY_B64);
    const hasWebhook = Boolean(process.env.DISCORD_WEBHOOK_URL);
    log("Env check", {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      hasB64Key,
      hasWebhook,
    });

    const privateKey = Buffer.from(
      process.env.FIREBASE_PRIVATE_KEY_B64 || "",
      "base64"
    ).toString("utf-8");
    log("Private key decoded", {
      length: privateKey ? privateKey.length : 0,
      beginsWithBEGIN: privateKey.startsWith("-----BEGIN"),
    });

    // Firebase Admin SDK 初期化
    if (!admin.apps.length) {
      log("Initializing Firebase Admin");
      admin.initializeApp({
        credential: admin.credential.cert({
          type: process.env.FIREBASE_TYPE,
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI,
          token_uri: process.env.FIREBASE_TOKEN_URI,
          auth_provider_x509_cert_url:
            process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        }),
      });
      log("Firebase Admin initialized", { apps: admin.apps.length });
    } else {
      log("Firebase Admin already initialized", { apps: admin.apps.length });
    }
    const db = admin.firestore();

    // 指定年月の確定シフトをfinalShiftsコレクションから日付で検索
    const monthStr = String(month).padStart(2, "0");
    const prefix = `${year}-${monthStr}`;
    let shiftData = [];
    log("Querying Firestore", { prefix });
    try {
      const snapshot = await db
        .collection("finalShifts")
        .where("date", ">=", `${prefix}-01`)
        .where("date", "<=", `${prefix}-31`)
        .get();
      log("Firestore result", { count: snapshot.size, empty: snapshot.empty });
      if (snapshot.empty) {
        res
          .status(404)
          .json({ error: "指定年月の確定シフトが見つかりません。" });
        return;
      }
      shiftData = snapshot.docs.map((doc) => doc.data());
    } catch (error) {
      logErr("Firestore query error", error?.message);
      res.status(500).json({ error: "Firebase取得エラー", details: error.message });
      return;
    }

    // shiftDataを画像化
    const imageBuffer = generateShiftImage(shiftData, year, month);
    log("Image generated", { bytes: imageBuffer?.length || 0 });

    // Discordに画像送信
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      logErr("Missing DISCORD_WEBHOOK_URL");
      res.status(500).json({ error: "DISCORD_WEBHOOK_URLが未設定です" });
      return;
    }

    // multipart/form-data送信
    const form = new FormData();
    form.append("file", imageBuffer, {
      filename: `${year}-${monthStr}-shift.png`,
      contentType: "image/png",
    });
    form.append("content", `${year}年${month}月の確定シフト表です`);

    try {
      log("Sending to Discord");
      const discordRes = await fetch(webhookUrl, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });
      const text = await discordRes.text();
      if (!discordRes.ok) {
        logErr("Discord response not OK", discordRes.status, discordRes.statusText, text);
        throw new Error(`Discord送信失敗: ${discordRes.statusText}`);
      }
      log("Discord response OK", discordRes.status);
    } catch (error) {
      logErr("Discord send error", error?.message);
      res.status(500).json({ error: "Discord送信エラー", details: error.message });
      return;
    }

    log("Success");
    res.status(200).json({ message: "Discord送信成功", shiftData, requestId });
  } catch (error) {
    logErr("Unhandled error", error, error?.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
