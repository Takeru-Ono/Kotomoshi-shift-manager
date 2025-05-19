// pages/api/sendFinalShiftToDiscord.js

import admin from "firebase-admin";
import { generateShiftImage } from "../../lib/generateShiftImage";
import FormData from "form-data";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // デバッグ: 環境変数のPRIVATE KEYの先頭50文字を出力
    console.log("PRIVATE KEY SAMPLE:");
    console.log(process.env.FIREBASE_PRIVATE_KEY?.slice(0, 50));
    console.log(process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').slice(0, 50));

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

    const privateKey = Buffer.from(
      process.env.FIREBASE_PRIVATE_KEY_B64 || "",
      "base64"
    ).toString("utf-8");


    // Firebase Admin SDK 初期化
    if (!admin.apps.length) {
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
          auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        }),
      });
    }
    const db = admin.firestore();

    // 指定年月の確定シフトをfinalShiftsコレクションから日付で検索
    const monthStr = String(month).padStart(2, "0");
    const prefix = `${year}-${monthStr}`;
    let shiftData = [];
    try {
      const snapshot = await db.collection("finalShifts")
        .where("date", ">=", `${prefix}-01`)
        .where("date", "<=", `${prefix}-31`)
        .get();
      if (snapshot.empty) {
        res.status(404).json({ error: "指定年月の確定シフトが見つかりません。" });
        return;
      }
      shiftData = snapshot.docs.map(doc => doc.data());
    } catch (error) {
      res.status(500).json({ error: "Firebase取得エラー", details: error.message });
      return;
    }

    // shiftDataを画像化
    const imageBuffer = generateShiftImage(shiftData, year, month);

    // Discordに画像送信
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
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
      const discordRes = await fetch(webhookUrl, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });
      if (!discordRes.ok) {
        throw new Error(`Discord送信失敗: ${discordRes.statusText}`);
      }
    } catch (error) {
      res.status(500).json({ error: "Discord送信エラー", details: error.message });
      return;
    }

    res.status(200).json({ message: "Discord送信成功", shiftData });
  } catch (error) {
    console.log("req.body:", req.body);
    console.error('sendFinalShiftToDiscord error:', error, JSON.stringify(error), error.message);

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }

}
