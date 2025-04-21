import express from "express";
import { sendMonthlyShiftsToDiscord } from "./discord.js";
import cors from "cors";
import getFinalShiftsByMonth from "./getFinalShiftsByMonth.js"; // 👈 getFinalShifts 関数をインポート

const app = express();
app.use(cors({
  origin: 'http://localhost:3000' // フロントエンドのオリジン
}));
app.use(express.json()); // JSONリクエストをパース

app.get("/test", (req, res) => {
  console.log("Test endpoint hit!");
  res.status(200).send("Test endpoint works!");
});

// APIエンドポイント: Discordにシフトを送信
app.post("/send-discord", async (req, res) => {
  const { month, year } = req.body; // 👈 リクエストボディから年月を取得
  console.log("受信した月:", month);
  console.log("受信した年:", year);

  try {
    const allShifts = await getFinalShiftsByMonth(); // 👈 Firestore からすべてのシフトデータを取得
    console.log("取得したシフトデータ:", allShifts);

    // サーバーサイドでフィルタリング
    const shifts = allShifts.filter((shift) => shift.date.includes(month));

    await sendMonthlyShiftsToDiscord(month, year, shifts);
    res.status(200).send("Discordに送信しました！");
  } catch (error) {
    console.error("APIエラー:", error);
    res.status(500).send("Discord送信に失敗しました。");
  }
});

// サーバーを起動
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`APIサーバーがポート${PORT}で起動しました`);
});
