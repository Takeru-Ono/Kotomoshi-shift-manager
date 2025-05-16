// pages/api/sendFinalShiftToDiscord.js

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

  // Firebase Admin SDK 初期化
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
  const { createCanvas } = require("canvas");
  const canvasWidth = 900;
  const canvasHeight = 80 + shiftData.length * 32;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // 背景
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // タイトル
  ctx.fillStyle = "#222";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(`${year}年${month}月 シフト表`, 40, 60);

  // shiftDataをテキストで描画（各日付・担当者・時間帯）
  ctx.font = "20px sans-serif";
  let y = 110;
  if (shiftData.length > 0) {
    shiftData.forEach((item) => {
      ctx.fillText(
        `${item.date} ${item.displayName || item.user} ${Array.isArray(item.times) ? item.times.join(", ") : ""}`,
        40,
        y
      );
      y += 32;
    });
  } else {
    ctx.fillText("データがありません", 40, y);
  }

  // PNGバッファ生成
  const imageBuffer = canvas.toBuffer("image/png");

  // Discordに画像送信
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(500).json({ error: "DISCORD_WEBHOOK_URLが未設定です" });
    return;
  }

  // multipart/form-data送信
  const FormData = require("form-data");
  const fetch = require("node-fetch");
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
}
