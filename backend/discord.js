const { WebhookClient } = require("discord.js");
const { createCanvas } = require("canvas");

const sendMonthlyShiftsToDiscord = async (month, shifts) => {
  try {
    // Discord WebhookのURL
    const webhookClient = new WebhookClient({ url: "https://discord.com/api/webhooks/1357315652309876736/HRe7rrjmSM4vQkVFl6NU8PryDbWGWST4LaVRiBE78nsFHr_Tjo6E12_BbvREVNirzyCz" });
    console.log("Webhook URL:", webhookClient.url); // URLを確認
    
    // 画像を生成
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext("2d");

    // 背景色
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = "#000000";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`${month} の確定版シフト`, 50, 50);

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
      content: `${month} の確定版シフトを送信します。`,
      files: [{ attachment: imageBuffer, name: "monthly-shifts.png" }],
    });

    console.log("Discordにシフトデータを送信しました！");
  } catch (error) {
    console.error("Discord送信エラー:", error);
  }
};

module.exports = { sendMonthlyShiftsToDiscord };