const express = require("express");
const { sendMonthlyShiftsToDiscord } = require("./discord");

const app = express();
app.use(express.json()); // JSONリクエストをパース

// APIエンドポイント: Discordにシフトを送信
app.post("/send-discord", async (req, res) => {
  const { month, shifts } = req.body;
  console.log("受信した月:", month);
  console.log("受信したシフトデータ:", shifts);

  try {
    await sendMonthlyShiftsToDiscord(month, shifts);
    res.status(200).send("Discordに送信しました！");
  } catch (error) {
    console.error("APIエラー:", error);
    res.status(500).send("Discord送信に失敗しました。");
  }
});

// サーバーを起動
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`APIサーバーがポート${PORT}で起動しました`);
});