// lib/generateShiftImage.js

const { createCanvas } = require("canvas");

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
                        return Math.min(...times.map(t => {
                            const [h, m] = t.split(":").map(Number);
                            return h + (m === 30 ? 0.5 : 0);
                        }));
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
                return Math.min(...times.map(t => {
                    const [h, m] = t.split(":").map(Number);
                    return h + (m === 30 ? 0.5 : 0);
                }));
            };
            return getMinTime(a.times) - getMinTime(b.times);
        });
        dateGroups.push(group);
    }

    // 各日付グループごとに赤塗り対象の時間帯を判定
    const groupRedSlots = [];
    for (const group of dateGroups) {
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
            for (const row of group.rows) {
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
    ctx.font = "bold 28px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`${year}年${month}月 シフト表`, 24, 12);

    // 時間ラベル（右3/4ヘッダー）
    ctx.font = "bold 13px sans-serif";
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
    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    let rowIdx = 0;
    for (let g = 0; g < dateGroups.length; g++) {
        const group = dateGroups[g];
        const groupRowCount = group.rows.length;
        const groupY = headerHeight + rowIdx * rowHeight;
        const hasRedRow = groupRedSlots[g].length > 0;
        const groupTotalRows = hasRedRow ? groupRowCount + 1 : groupRowCount;

        // 日付セル（縦結合、空白行も含めて結合）
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, groupY, dateCellWidth, rowHeight * groupTotalRows);
        ctx.clip();
        ctx.fillStyle = "#222";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            group.date,
            dateCellWidth / 2,
            groupY + (rowHeight * groupTotalRows) / 2
        );
        ctx.restore();

        // 各ユーザー行
        for (let i = 0; i < groupRowCount; i++) {
            const row = group.rows[i];
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
                for (let i = 0; i < userEmail.length; i++) {
                    hash ^= userEmail.charCodeAt(i);
                    hash = Math.imul(hash, 16777619);
                }
                hash = Math.abs(hash);

                // 複数パラメータで色を決定
                const hue = hash % 360;
                const sat = 55 + (hash % 30); // 55-84%
                const light = 75 + (Math.floor(hash / 360) % 15); // 75-89%
                return `hsl(${hue}, ${sat}%, ${light}%)`;
            };
            ctx.fillStyle = getUserColor(row.user || row.displayName || "");
            ctx.fillRect(dateCellWidth, y, nameCellWidth, rowHeight);
            ctx.fillStyle = "#333";
            ctx.font = "15px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(
                row.displayName || row.user,
                dateCellWidth + 10,
                y + rowHeight / 2
            );
            ctx.restore();

            // 右側：時間セル
            const times = Array.isArray(row.times) ? row.times : [];
            for (let col = 0; col < numCols; col++) {
                const x = leftCellWidth + col * cellWidth;
                // 枠線
                ctx.strokeStyle = "#ddd";
                ctx.strokeRect(x, y, cellWidth, rowHeight);

                // 該当時間帯なら塗りつぶし
                if (times.includes(timeSlots[col])) {
                    ctx.fillStyle = "#4f8cff";
                    ctx.fillRect(x + 1, y + 1, cellWidth - 2, rowHeight - 2);
                }
            }
        }

        // 空白行（赤塗り用）
        if (hasRedRow) {
            const y = headerHeight + (rowIdx + groupRowCount) * rowHeight;
            // 名前セルは空白
            // 右側：赤塗りセル
            for (let col = 0; col < numCols; col++) {
                const x = leftCellWidth + col * cellWidth;
                // 枠線
                ctx.strokeStyle = "#ddd";
                ctx.strokeRect(x, y, cellWidth, rowHeight);

                // 赤塗り対象のみ塗る
                if (groupRedSlots[g].includes(col)) {
                    ctx.fillStyle = "#ff4f4f";
                    ctx.fillRect(x + 1, y + 1, cellWidth - 2, rowHeight - 2);
                }
            }
        }

        // 日付区切りの横線（太線）
        ctx.save();
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groupY);
        ctx.lineTo(canvasWidth, groupY);
        ctx.stroke();
        ctx.restore();

        // 次のグループへ
        rowIdx += groupTotalRows;
    }

    // 通常の行区切り線（細線）
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    let drawnRows = 0;
    for (let g = 0; g < dateGroups.length; g++) {
        const group = dateGroups[g];
        const groupRowCount = group.rows.length;
        const hasRedRow = groupRedSlots[g].length > 0;
        const groupTotalRows = hasRedRow ? groupRowCount + 1 : groupRowCount;
        for (let i = 0; i < groupTotalRows; i++) {
            const y = headerHeight + (drawnRows + i) * rowHeight;
            // 日付区切り線は既に太線で描画済みなのでスキップ
            if (i === 0) continue;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
        drawnRows += groupTotalRows;
    }

    // 左列の縦線（dateとnameの間）
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dateCellWidth, headerHeight - 4);
    ctx.lineTo(dateCellWidth, canvasHeight);
    ctx.stroke();

    // nameと時間セルの間
    ctx.beginPath();
    ctx.moveTo(leftCellWidth, headerHeight - 4);
    ctx.lineTo(leftCellWidth, canvasHeight);
    ctx.stroke();

    return canvas.toBuffer("image/png");
}

module.exports = { generateShiftImage };
