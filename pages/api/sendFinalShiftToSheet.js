import admin from "firebase-admin";
import { google } from "googleapis";


// pages/api/sendFinalShiftToSheet.js

// TODO: Google Sheets API連携のための認証・設定を追加
export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    // 年・月情報を受け取る
    const { year, month } = req.body;

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

    // Google Sheets API認証セットアップ
    const sheetsAuth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        undefined,
        Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64 || "", "base64").toString("utf-8"),
        ["https://www.googleapis.com/auth/spreadsheets"]
    );
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

    // スプレッドシートIDとシート名を設定
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = `${year}${monthStr}`; // 例: 202505

    // シートの先頭部分（A1:AK10）を取得して名前・日付の位置を特定
    let sheetValues;
    try {
        const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:AK10`,
            auth: sheetsAuth,
        });
        sheetValues = getRes.data.values || [];
    } catch (error) {
        res.status(500).json({ error: "シートの読み取りに失敗しました", details: error.message });
        return;
    }

    // B3-B10の名前リスト抽出
    const nameRows = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // 0-indexed: 2~9 = B3~B10
    const names = nameRows.map(r => (sheetValues[r] && sheetValues[r][1]) ? sheetValues[r][1] : null).filter(Boolean);

    // C1, E1, G1...の日付リスト抽出（2列ごと、結合セル対応）
    // シートの日付が "2025/05/01" 形式でなく "05/01" などの場合も正規化
    function normalizeSheetDate(val) {
        // 例: "05/01" → "2025/05/01"（year, monthを使う）
        let v = String(val || "").trim();
        if (/^\d{2}\/\d{2}$/.test(v)) {
            return `${year}/${monthStr}/${v.slice(-2)}`;
        }
        // 例: "2025/5/1" → "2025/05/01"
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) {
            const [y, m, d] = v.split("/");
            return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
        }
        return v;
    }
    const dateCols = [];
    const dates = [];
    if (sheetValues[0]) {
        for (let c = 2; c < sheetValues[0].length; c += 2) { // C=2, E=4, G=6...
            const raw = sheetValues[0][c];
            const val = normalizeSheetDate(raw);
            if (val) {
                dateCols.push(c);
                dates.push(val);
            }
        }
    }

    // (name, date)→cell位置のマッピング
    // B列: 2,3,4,5,6,7,8,9 (B3~B10), C〜AK列: 2〜36 (C=2)
    // 例: C3, D3, ... AK3 ... C10, D10, ... AK10
    const cellMap = [];
    names.forEach((name, i) => {
        dateCols.forEach((colIdx, j) => {
            cellMap.push({
                name,
                date: dates[j],
                cell: {
                    row: nameRows[i] + 1, // 1-indexed for A1 notation
                    col: colIdx + 1 // 1-indexed for A1 notation
                }
            });
        });
    });

    // shiftDataから各(名前,日付)の時間帯を抽出
    function groupConsecutiveTimes(times) {
        if (!Array.isArray(times) || times.length === 0) return "";
        // ["13:00", "13:30", "18:00", "18:30"] → [13.0, 13.5, 18.0, 18.5]
        const sorted = [...new Set(times)].map(t => {
            const [h, m] = t.split(":").map(Number);
            return h + (m === 30 ? 0.5 : 0);
        }).sort((a, b) => a - b);
        let result = [];
        let start = sorted[0];
        let prev = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] !== prev + 0.5) {
                result.push(`${formatTime(start)}-${formatTime(prev + 0.5)}`);
                start = sorted[i];
            }
            prev = sorted[i];
        }
        result.push(`${formatTime(start)}-${formatTime(prev + 0.5)}`);
        return result.join(", ");
    }
    function formatTime(time) {
        const hour = Math.floor(time);
        const minute = time % 1 === 0.5 ? "30" : "00";
        return `${hour}:${minute}`;
    }

    // Firestoreから取得した全データをdisplayName, date, 整形済みtimeで返す
    const ShiftData = shiftData.map(s => ({
        name: s.displayName || s.user,
        date: s.date ? s.date.replace(/-/g, "/") : "",
        value: groupConsecutiveTimes(s.times)
    }));

    // 書き込みリクエスト作成
    const updates = [];
    // デバッグ: どのセルに何を書き込むかを記録
    const debugWrite = [];
    ShiftData.forEach(({ name, date, value }) => {
        // 名前がB3-10に存在するか
        const nameIdx = names.findIndex(n => n && n.trim() === name.trim());
        // 日付がC1, E1, ... AK1に存在するか
        const dateIdx = dates.findIndex(d => d && d.trim() === date.trim());
        if (nameIdx !== -1 && dateIdx !== -1) {
            // 行番号
            const row = nameRows[nameIdx] + 1;
            // 列番号
            const col = dateCols[dateIdx] + 1;
            // A1表記に変換
            function toA1Col(n) {
                let s = "";
                while (n > 0) {
                    n--;
                    s = String.fromCharCode((n % 26) + 65) + s;
                    n = Math.floor(n / 26);
                }
                return s;
            }
            const colLetter = toA1Col(col);
            const a1 = `${colLetter}${row}`;
            updates.push({
                range: `${sheetName}!${a1}`,
                values: [[value]]
            });
            debugWrite.push({ name, date, value, a1 });
        } else {
            debugWrite.push({ name, date, value, a1: null, reason: `nameIdx=${nameIdx}, dateIdx=${dateIdx}` });
        }
    });

    // まずC3:AM10の偶数列（C, E, G, ..., AM）をクリア
    const clearRanges = [];
    const colLetters = [
        "C", "E", "G", "I", "K", "M", "O", "Q", "S", "U", "W", "Y", "AA", "AC", "AE", "AG", "AI", "AK", "AM"
    ];
    colLetters.forEach(col => {
        clearRanges.push(`${sheetName}!${col}3:${col}10`);
    });
    try {
        await sheets.spreadsheets.values.batchClear({
            spreadsheetId,
            auth: sheetsAuth,
            requestBody: {
                ranges: clearRanges
            }
        });
    } catch (error) {
        res.status(500).json({ error: "シートクリアに失敗しました", details: error.message, clearRanges });
        return;
    }

    // Google Sheetsへ一括書き込み
    try {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            auth: sheetsAuth,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: updates
            }
        });
    } catch (error) {
        res.status(500).json({ error: "シートへの書き込みに失敗しました", details: error.message, updates });
        return;
    }

    // 書き込んだセルの値を即時取得して返す
    try {
        await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            auth: sheetsAuth,
            ranges: updates.map(u => u.range)
        });
    } catch {
        // ignore
    }

    // シート全体の状態も取得して返す
    try {
        await sheets.spreadsheets.values.get({
            spreadsheetId,
            auth: sheetsAuth,
            range: `${sheetName}!A1:H20`
        });
    } catch {
        // ignore
    }

    res.status(200).json({
        message: "Google Sheetsへの反映が完了しました",
        year,
        month,
        ShiftData,
        debugWrite
    });
}
