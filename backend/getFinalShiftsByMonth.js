import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase.js"; // Firestore のインスタンスをインポート

const getFinalShiftsByMonth = async (month, year) => {
  try {
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`; // `YYYY-MM` 形式を作成
    const finalShiftsRef = collection(db, "finalShifts");

    // クエリを作成
    const q = query(
      finalShiftsRef,
      where("date", ">=", `${yearMonth}-01`), // 月の最初の日
      where("date", "<=", `${yearMonth}-31`) // 月の最後の日
    );

    // クエリを実行
    const querySnapshot = await getDocs(q);

    // ドキュメントを抽出
    const shifts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return shifts;
  } catch (error) {
    console.error("Firestoreからのデータ取得エラー:", error);
    throw error;
  }
};

export default getFinalShiftsByMonth;