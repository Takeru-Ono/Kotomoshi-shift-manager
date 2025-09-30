const FINAL_SHIFTS_COLLECTION = "finalShifts";

function padMonth(month) {
  return String(month).padStart(2, "0");
}

export async function fetchFinalShiftsByMonth({ db, year, month }) {
  if (!db) throw new Error("Firestore instance (db) is required");
  if (typeof year !== "number" || typeof month !== "number") {
    throw new Error("year and month must be numbers");
  }

  const monthStr = padMonth(month);
  const prefix = `${year}-${monthStr}`;
  const snapshot = await db
    .collection(FINAL_SHIFTS_COLLECTION)
    .where("date", ">=", `${prefix}-01`)
    .where("date", "<=", `${prefix}-31`)
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((doc) => doc.data());
}
