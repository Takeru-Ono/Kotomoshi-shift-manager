import { fetchFinalShiftsByMonth } from "./firestore.js";

function ensureNumber(value, name) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }
}

function normalizeSheetDateFactory(year, monthStr) {
  return function normalizeSheetDate(val) {
    let v = String(val || "").trim();
    if (/^\d{2}\/\d{2}$/.test(v)) {
      return `${year}/${monthStr}/${v.slice(-2)}`;
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) {
      const [y, m, d] = v.split("/");
      return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
    }
    return v;
  };
}

function groupConsecutiveTimes(times) {
  if (!Array.isArray(times) || times.length === 0) return "";
  const sorted = [...new Set(times)]
    .map((t) => {
      const [h, m] = t.split(":").map(Number);
      return h + (m === 30 ? 0.5 : 0);
    })
    .sort((a, b) => a - b);
  const result = [];
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

function toA1Col(n) {
  let s = "";
  let num = n;
  while (num > 0) {
    num--;
    s = String.fromCharCode((num % 26) + 65) + s;
    num = Math.floor(num / 26);
  }
  return s;
}

export async function sendFinalShiftToSheet({
  db,
  year,
  month,
  sheetsClient,
  spreadsheetId,
  sheetName,
}) {
  if (!db) throw new Error("Firestore db instance is required");
  if (!sheetsClient) throw new Error("Google Sheets client is required");
  if (!spreadsheetId) throw new Error("spreadsheetId is required");

  ensureNumber(year, "year");
  ensureNumber(month, "month");

  const monthStr = String(month).padStart(2, "0");
  const effectiveSheetName = sheetName || `${year}${monthStr}`;
  const normalizeSheetDate = normalizeSheetDateFactory(year, monthStr);

  const rawShiftData = await fetchFinalShiftsByMonth({ db, year, month });
  if (rawShiftData.length === 0) {
    const err = new Error("指定年月の確定シフトが見つかりません。");
    err.code = "NOT_FOUND";
    throw err;
  }

  const sheetValuesRes = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: `${effectiveSheetName}!A1:AK11`,
  });
  const sheetValues = sheetValuesRes.data.values || [];

  // B3-B11の名前リスト抽出
  const nameRows = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const names = nameRows
    .map((r) => (sheetValues[r] && sheetValues[r][1] ? sheetValues[r][1] : null))
    .filter(Boolean);

  // C1, E1, G1...の日付リスト抽出
  const dateCols = [];
  const dates = [];
  if (sheetValues[0]) {
    for (let c = 2; c < sheetValues[0].length; c += 2) {
      const raw = sheetValues[0][c];
      const val = normalizeSheetDate(raw);
      if (val) {
        dateCols.push(c);
        dates.push(val);
      }
    }
  }

  const ShiftData = rawShiftData.map((s) => ({
    name: s.displayName || s.user,
    date: s.date ? s.date.replace(/-/g, "/") : "",
    value: groupConsecutiveTimes(s.times),
  }));

  const updates = [];
  const debugWrite = [];

  ShiftData.forEach(({ name, date, value }) => {
    const nameIdx = names.findIndex((n) => n && n.trim() === name.trim());
    const dateIdx = dates.findIndex((d) => d && d.trim() === date.trim());
    if (nameIdx !== -1 && dateIdx !== -1) {
      const row = nameRows[nameIdx] + 1;
      const col = dateCols[dateIdx] + 1;
      const colLetter = toA1Col(col);
      const a1 = `${colLetter}${row}`;
      updates.push({
        range: `${effectiveSheetName}!${a1}`,
        values: [[value]],
      });
      debugWrite.push({ name, date, value, a1 });
    } else {
      debugWrite.push({
        name,
        date,
        value,
        a1: null,
        reason: `nameIdx=${nameIdx}, dateIdx=${dateIdx}`,
      });
    }
  });

  const colLetters = [
    "C",
    "E",
    "G",
    "I",
    "K",
    "M",
    "O",
    "Q",
    "S",
    "U",
    "W",
    "Y",
    "AA",
    "AC",
    "AE",
    "AG",
    "AI",
    "AK",
    "AM",
  ];
  const clearRanges = colLetters.map(
    (col) => `${effectiveSheetName}!${col}3:${col}11`
  );

  await sheetsClient.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: {
      ranges: clearRanges,
    },
  });

  if (updates.length > 0) {
    await sheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });
  }

  return {
    message: "Google Sheetsへの反映が完了しました",
    year,
    month,
    ShiftData,
    debugWrite,
  };
}
