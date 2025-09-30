import { fetchFinalShiftsByMonth } from "./firestore.js";
import { generateShiftImage as defaultGenerateShiftImage } from "./generateShiftImage.js";

function ensureNumber(value, name) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }
}

export async function sendFinalShiftToDiscord({
  db,
  year,
  month,
  webhookUrl,
  FormDataCtor,
  fetchImpl,
  generateShiftImage = defaultGenerateShiftImage,
}) {
  if (!db) throw new Error("Firestore db instance is required");
  if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL is required");
  ensureNumber(year, "year");
  ensureNumber(month, "month");

  const activeFetch = fetchImpl || globalThis.fetch;
  if (!activeFetch) {
    throw new Error("fetch implementation is required");
  }

  let FormDataClass = FormDataCtor;
  if (!FormDataClass) {
    const mod = await import("form-data");
    FormDataClass = mod.default;
  }

  const shiftData = await fetchFinalShiftsByMonth({ db, year, month });
  if (shiftData.length === 0) {
    const err = new Error("指定年月の確定シフトが見つかりません。");
    err.code = "NOT_FOUND";
    throw err;
  }

  const monthStr = String(month).padStart(2, "0");
  const imageBuffer = generateShiftImage(shiftData, year, month);

  const form = new FormDataClass();
  form.append("file", imageBuffer, {
    filename: `${year}-${monthStr}-shift.png`,
    contentType: "image/png",
  });
  form.append("content", `${year}年${month}月の確定シフト表です`);

  const res = await activeFetch(webhookUrl, {
    method: "POST",
    body: form,
    headers: form.getHeaders ? form.getHeaders() : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord送信失敗: ${res.status} ${res.statusText} ${text}`.trim());
  }

  return { message: "Discord送信成功", shiftData };
}
