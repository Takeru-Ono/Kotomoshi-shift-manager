import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, fetchAdmins } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function FinalShifts({ user, onBack }) {
  const [finalShifts, setFinalShifts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateShifts, setSelectedDateShifts] = useState([]);
  
  const timeSlots = Array.from({ length: 25 }, (_, i) => {
    const hour = 9 + Math.floor(i / 2);  // 9時からスタート
    const minute = i % 2 === 0 ? "00" : "30"; // 00分か30分
    return `${hour}:${minute}`;
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchFinalShifts = async () => {
      const snapshot = await getDocs(collection(db, "finalShifts"));
      setFinalShifts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchFinalShifts();
  }, []);
  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminEmails = await fetchAdmins(); // Firestore から管理者リストを取得
      console.log("管理者リスト:", adminEmails); // 🔍 デバッグ用（管理者リストを出力）
      console.log("現在のユーザー:", user?.email); // 🔍 現在のユーザーを確認
      setIsAdmin(adminEmails.includes(user?.email)); // 🚀 管理者なら `true` にする
    };
  
    if (user) checkAdminStatus();
  }, [user]);

  useEffect(() => {
    const finalShiftsRef = collection(db, "finalShifts");
  
    // 🔥 Firestore の変更をリアルタイムで取得
    const unsubscribe = onSnapshot(finalShiftsRef, (snapshot) => {
      const shifts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      // 🔽 日付順に並び替えてカレンダーに即時反映
      setFinalShifts(shifts.sort((a, b) => a.date.localeCompare(b.date)));
    });
  
    return () => unsubscribe();
  }, []);

  // ユーザーごとの色を決定する関数（赤を除外）
const getUserColor = (userId) => {
  const hash = Array.from(userId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = (hash % 330) + 30; // 30〜360の間で色相を生成（赤を除外）
  return `hsl(${hue}, 70%, 60%)`; // 彩度と明度を調整
};

  const handleDateClick = (date) => {
    const formattedDate = date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    setSelectedDate(formattedDate);
    setSelectedDateShifts(finalShifts.filter(shift => shift.date === formattedDate));
  };

  const tileContent = ({ date }) => {
    const formattedDate = date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    const shiftsOnDate = finalShifts.filter(shift => shift.date === formattedDate);
  
    return (
      <div className="text-xs text-center">
        {shiftsOnDate.map(shift => {
          const userColor = getUserColor(shift.user); // ユーザーの色を取得
          return (
            <div
              key={shift.id}
              className="rounded px-1 my-0.5"
              style={{ backgroundColor: userColor, color: "#fff" }} // 🔥 ユーザーごとに異なる背景色を適用
            >
              {shift.displayName || shift.user}
            </div>
          );
        })}
      </div>
    );
  };

    // 連続した時間を `start - end` の形にまとめる関数
    const groupConsecutiveTimes = (times) => {
      if (times.length === 0) return [];
    
      // 🔹 時間を数値でソート（["13:00", "13:30", "18:00", "18:30"] → [13.0, 13.5, 18.0, 18.5]）
      const sortedTimes = [...new Set(times)] // 重複を削除
        .map(t => {
          const [hour, min] = t.split(":").map(Number);
          return hour + (min === 30 ? 0.5 : 0);
        })
        .sort((a, b) => a - b);
    
      const grouped = [];
      let start = sortedTimes[0];
      let prev = sortedTimes[0];
    
      for (let i = 1; i < sortedTimes.length; i++) {
        if (sortedTimes[i] !== prev + 0.5) {
          // 🔥 連続していなかったら、グループ化
          grouped.push(`${formatTime(start)} - ${formatTime(prev + 0.5)}`);
          start = sortedTimes[i];
        }
        prev = sortedTimes[i];
      }
    
      // 最後のグループを追加
      grouped.push(`${formatTime(start)} - ${formatTime(prev + 0.5)}`);
    
      return grouped;
    };
    
    // 🔽 時間フォーマットを統一する関数（"9.5" → "9:30" に変換）
    const formatTime = (time) => {
      const hour = Math.floor(time);
      const minute = time % 1 === 0.5 ? "30" : "00";
      return `${hour}:${minute}`;
    };

const handleDeleteFinalShift = async (shiftId) => {
  const confirmDelete = window.confirm("この確定シフトを削除しますか？");
  if (!confirmDelete) return;

  try {
    // 🔽 Firestore からシフトを削除
    await deleteDoc(doc(db, "finalShifts", shiftId));

    // 🔥 Firestore から削除後、シフト一覧とスケジュールを即時更新
    setFinalShifts((prev) => prev.filter((shift) => shift.id !== shiftId));

    setSelectedDateShifts((prev) => {
      return prev.filter((shift) => shift.id !== shiftId);
    });
  } catch (error) {
    console.error("エラー:", error);
  }
};

  return (
    <div className="w-full max-w-screen-2xl mx-auto p-4 border rounded-lg shadow-md bg-white">
      
      {/* 🔽 上段：カレンダー (w-2/3) & 時刻表 (w-1/3) */}
      <div className="flex gap-6 overflow-hidden">
        {/* 🔽 カレンダー (w-2/3) */}
        <div className="w-full md:w-1/2 flex flex-col">
          <h2 className="text-lg font-bold mb-4">確定版シフト</h2>
          <div className="p-4 border rounded shadow-md w-full">
            <Calendar tileContent={tileContent} 
            onClickDay={handleDateClick} 
            className="w-full h-full text-sm"
            />
          </div>
                {/* 🔽 下段：確定版シフトリスト (w-full) */}
      {selectedDate && (
        <div className="w-full mt-2">
          <h3 className="font-bold">{selectedDate} の確定シフト一覧</h3>
          <ul className="w-full">
            {selectedDateShifts.map((shift) => {
              const groupedTimes = groupConsecutiveTimes(shift.times);
              return (
                <li
                  key={shift.id}
                  className="border p-2 my-2 shadow-sm flex flex-wrap items-center gap-4 w-full cursor-pointer hover:bg-gray-100 transition"
                >
                  {/* ✅ ユーザー名 */}
                  <span className="text-sm text-gray-600 min-w-[150px]">{shift.displayName || shift.user}</span>
                  
                  {/* ✅ 時間帯 */}
                  <span className="flex-1 whitespace-normal break-words">{groupedTimes.join(", ")}</span>

                  {/* 🔽 削除ボタン（管理者のみ） */}
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteFinalShift(shift.id)}
                      className="bg-red-500 text-white p-1 rounded text-sm min-w-[80px] text-center"
                    >
                      削除
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
        </div>

        {/* 🔽 右側：時刻表 */}
<div className="border-l pl-6 min-w-[220px] w-1/2">
  <h3 className="font-bold mb-2">{selectedDate}</h3>
  <div className="relative left-10 w-full h-[770px]">
    {timeSlots.map((time, index) => {
      // 指定の時間帯に入っているシフトを取得
      const shiftsAtTime = selectedDateShifts.filter(shift => shift.times.includes(time));
      const totalShifts = shiftsAtTime.length; // その時間帯のシフト人数

      return (
        <div key={time} className="relative flex items-center h-[30px] cursor-pointer">
          {/* 時間ラベル（1時間ごと） */}
            <span className="absolute -left-8 text-sm">{time}</span>
          

          {/* 時間を区切る線 */}
          <div className="absolute left-[60px] top-3 w-full h-[1px] bg-gray-400 transform -translate-y-1/2"></div>

          {/* 🔽 複数人のシフトを 30% 幅で配置 */}
          {shiftsAtTime.map((shift, shiftIndex) => {
            const shiftWidth = "20%"; // 1人あたりの幅
            const shiftLeft = `calc(60px + ${shiftIndex * 20}%)`; // 右にずらして配置

            return (
              <div
                key={shift.id}
                className="absolute top-3 h-full flex items-center justify-center text-white text-xs rounded"
                style={{
                  backgroundColor: getUserColor(shift.user),
                  left: shiftLeft,
                  width: shiftWidth,
                }}
              >
                {shift.displayName}
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
</div>
      </div>
    </div>
  );
}