import { WebhookClient } from "discord.js";
import { createCanvas } from "canvas";
import dotenv from "dotenv";

dotenv.config(); // 環境変数を読み込む

export const sendMonthlyShiftsToDiscord = async (month, year, shifts) => {
  try {
    // Discord WebhookのURLを環境変数から取得
    const webhookURL = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookURL) {
      throw new Error("Discord Webhook URL が設定されていません。");
    }

    const webhookClient = new WebhookClient({ url: webhookURL });
    console.log("Webhook URL:", webhookClient.url); // Webhook URLを確認
    console.log("送信するシフトデータ:", shifts); // シフトデータを確認
    console.log("送信する年:", year); // 送信する年を確認

    // 画像を生成
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext("2d");

    // 背景色
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = "#000000";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`${month} ${year} の確定版シフト`, 50, 50); // 年もタイトルに含める

    // シフトデータを描画
    ctx.font = "16px Arial";
    shifts.forEach((shift, index) => {
      const y = 100 + index * 30;
      ctx.fillText(
        `${shift.date} - ${shift.displayName || shift.user}: ${shift.times.join(", ")}`,
        50,
        y
      );
    });

    // 画像をバッファとして取得
    const imageBuffer = canvas.toBuffer();

    // Discordに送信
    await webhookClient.send({
      content: `${month} ${year} の確定版シフトを送信します。`, // 年もコンテンツに含める
      files: [{ attachment: imageBuffer, name: "monthly-shifts.png" }],
    });

    console.log("Discordにシフトデータを送信しました！");
  } catch (error) {
    console.error("Discord送信エラー:", error);
  }
};