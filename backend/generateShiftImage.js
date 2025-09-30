import { createCanvas, registerFont } from "canvas";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// フォントファイルの絶対パスを構築
const fontPath = path.resolve(__dirname, "fonts/NotoSansJP-Regular.ttf");

if (fs.existsSync(fontPath)) {
  registerFont(fontPath, { family: "Noto Sans JP" });
} else {
  console.warn("NotoSansJP-Regular.ttf not found:", fontPath);
}

/**
 * シフトデータから表形式のPNG画像バッファを生成
 * 左1/4: 日付セル（同日付は結合）、左2/4: 名前セル、右3/4: 11:00〜21:00の時間セル
 * 日付区切りの横線は太く描画
 * 誰も入らない時間帯がある場合は空白行を追加し、その行の該当セルを赤く塗る
 * @param {Object[]} shiftData - シフトデータ配列
 * @param {number} year - 年
 * @param {number} month - 月
 * @returns {Buffer} PNG画像バッファ
 */
function generateShiftImage(shiftData, year, month) {
  // 定数
  const canvasWidth = 900;
  const rowHeight = 36;
  const headerHeight = 60;
  const dateCellWidth = Math.floor(canvasWidth * 0.13); // 左1/8
  const nameCellWidth = Math.floor(canvasWidth * 0.12); // 左1/8
  const leftCellWidth = dateCellWidth + nameCellWidth;
  const rightCellWidth = canvasWidth - leftCellWidth;
  const timeStart = 11;
  const timeEnd = 21;
  const timeStep = 0.5;
  const timeSlots = [];
  for (let t = timeStart; t <= timeEnd; t += timeStep) {
    const hour = Math.floor(t);
    const min = t % 1 === 0.5 ? "30" : "00";
    timeSlots.push(`${hour}:${min}`);
  }
  const numCols = timeSlots.length;
  const cellWidth = rightCellWidth / numCols;

  // 日付ごとにグループ化
  const dateGroups = [];
  let prevDate = null;
  let group = null;
  for (const row of shiftData) {
    if (row.date !== prevDate) {
      if (group) {
        // シフト開始時刻が早い順に並べ替え
        group.rows.sort((a, b) => {
          const getMinTime = (times) => {
            if (!Array.isArray(times) || times.length === 0) return Infinity;
            return Math.min(
              ...times.map((t) => {
                const [h, m] = t.split(":").map(Number);
                return h + (m === 30 ? 0.5 : 0);
              })
            );
          };
          return getMinTime(a.times) - getMinTime(b.times);
        });
        dateGroups.push(group);
      }
      group = { date: row.date, rows: [] };
      prevDate = row.date;
    }
    group.rows.push(row);
  }
  if (group) {
    group.rows.sort((a, b) => {
      const getMinTime = (times) => {
        if (!Array.isArray(times) || times.length === 0) return Infinity;
        return Math.min(
          ...times.map((t) => {
            const [h, m] = t.split(":").map(Number);
            return h + (m === 30 ? 0.5 : 0);
          })
        );
      };
      return getMinTime(a.times) - getMinTime(b.times);
    });
    dateGroups.push(group);
  }

  // 各日付グループごとに赤塗り対象の時間帯を判定
  const groupRedSlots = [];
  for (const groupItem of dateGroups) {
    const redSlots = [];
    for (let col = 0; col < numCols; col++) {
      const slot = timeSlots[col];
      // 11:00, 11:30, 12:00, 20:30, 21:00は赤塗り対象外
      if (
        slot === "11:00" ||
        slot === "11:30" ||
        slot === "12:00" ||
        slot === "20:30" ||
        slot === "21:00"
      ) {
        continue;
      }
      let hasPerson = false;
      for (const row of groupItem.rows) {
        const times = Array.isArray(row.times) ? row.times : [];
        if (times.includes(slot)) {
          hasPerson = true;
          break;
        }
      }
      if (!hasPerson) {
        redSlots.push(col);
      }
    }
    groupRedSlots.push(redSlots);
  }

  // キャンバス高さ計算（空白行を追加する分も考慮）
  let totalRows = shiftData.length;
  for (const red of groupRedSlots) {
    if (red.length > 0) totalRows += 1;
  }
  const canvasHeight = headerHeight + rowHeight * totalRows;

  // Canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // 背景
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // タイトル
  ctx.fillStyle = "#222";
  ctx.font = "bold 28px 'Noto Sans JP'";
  ctx.textBaseline = "top";
  ctx.fillText(`${year}年${month}月 シフト表`, 24, 12);

  // 時間ラベル（右3/4ヘッダー）
  ctx.font = "bold 13px 'Noto Sans JP'";
  ctx.textAlign = "center";
  for (let i = 0; i < numCols; i++) {
    // 00分のセルだけ日本語で時刻ラベルを描画
    const [hour, min] = timeSlots[i].split(":");
    if (min === "00") {
      const x = leftCellWidth + i * cellWidth + cellWidth / 2;
      ctx.fillStyle = "#444";
      ctx.fillText(`${hour}時`, x, headerHeight - 22);
    }
  }

  // 枠線（ヘッダー下）
  ctx.strokeStyle = "#bbb";
  ctx.beginPath();
  ctx.moveTo(0, headerHeight - 4);
  ctx.lineTo(canvasWidth, headerHeight - 4);
  ctx.stroke();

  // 各行描画
  ctx.font = "16px 'Noto Sans JP'";
  ctx.textAlign = "left";
  let rowIdx = 0;
  for (let g = 0; g < dateGroups.length; g++) {
    const groupItem = dateGroups[g];
    const groupRowCount = groupItem.rows.length;
    const groupY = headerHeight + rowIdx * rowHeight;
    const hasRedRow = groupRedSlots[g].length > 0;
    const groupTotalRows = hasRedRow ? groupRowCount + 1 : groupRowCount;

    // 日付セル（縦結合、空白行も含めて結合）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, groupY, dateCellWidth, rowHeight * groupTotalRows);
    ctx.clip();
    ctx.fillStyle = "#222";
    ctx.font = "16px 'Noto Sans JP'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      groupItem.date,
      dateCellWidth / 2,
      groupY + (rowHeight * groupTotalRows) / 2
    );
    ctx.restore();

    // 各ユーザー行
    for (let i = 0; i < groupRowCount; i++) {
      const row = groupItem.rows[i];
      const y = headerHeight + (rowIdx + i) * rowHeight;

      // 名前セル
      ctx.save();
      ctx.beginPath();
      ctx.rect(dateCellWidth, y, nameCellWidth, rowHeight);
      ctx.clip();
      // ユーザーごとに目に優しい色
      const getUserColor = (userEmail) => {
        // FNV-1a風ハッシュで分散性を高める
        let hash = 2166136261;
        for (let j = 0; j < userEmail.length; j++) {
          hash ^= userEmail.charCodeAt(j);
          hash = Math.imul(hash, 16777619);
        }
        const r = (hash >>> 24) & 0xff;
        const g = (hash >>> 16) & 0xff;
        const b = (hash >>> 8) & 0xff;
        return `rgba(${r}, ${g}, ${b}, 0.75)`;
      };
      ctx.fillStyle = getUserColor(row.user || row.displayName || "unknown");
      ctx.fillRect(dateCellWidth, y, nameCellWidth, rowHeight);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px 'Noto Sans JP'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        row.displayName || row.user || "",
        dateCellWidth + nameCellWidth / 2,
        y + rowHeight / 2
      );
      ctx.restore();

      // 時間セル
      for (let col = 0; col < numCols; col++) {
        const slot = timeSlots[col];
        const cellX = leftCellWidth + col * cellWidth;
        const isActive = Array.isArray(row.times) && row.times.includes(slot);

        if (isActive) {
          ctx.fillStyle = "#4f46e5";
          ctx.fillRect(cellX, y, cellWidth, rowHeight);
        }

        ctx.strokeStyle = "#eee";
        ctx.strokeRect(cellX, y, cellWidth, rowHeight);
      }
    }

    // 赤塗り行（誰も入っていない時間帯）
    if (hasRedRow) {
      const redRowY = headerHeight + (rowIdx + groupRowCount) * rowHeight;
      for (let col = 0; col < numCols; col++) {
        const cellX = leftCellWidth + col * cellWidth;
        if (groupRedSlots[g].includes(col)) {
          ctx.fillStyle = "rgba(255, 99, 132, 0.5)";
          ctx.fillRect(cellX, redRowY, cellWidth, rowHeight);
        }
        ctx.strokeStyle = "#fbd5d5";
        ctx.strokeRect(cellX, redRowY, cellWidth, rowHeight);
      }
    }

    rowIdx += groupTotalRows;

    // 日付区切りの横線
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight + rowIdx * rowHeight);
    ctx.lineTo(canvasWidth, headerHeight + rowIdx * rowHeight);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  return canvas.toBuffer("image/png");
}

export { generateShiftImage };
