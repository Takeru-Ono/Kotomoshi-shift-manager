import { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db, fetchAdmins, auth } from "../firebase";
import { signOut } from "firebase/auth";
import FinalShifts from "./FinalShifts";
import HeaderWithTabs from "./HeaderWithTabs";
import { collection, addDoc, getDocs, onSnapshot, setDoc, doc, deleteDoc } from "firebase/firestore";
import { CalendarIcon } from "@heroicons/react/24/outline"; 

export default function ShiftCalendar({ user, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimes, setSelectedTimes] = useState([]); // 選択した時間を保存
  const [shifts, setShifts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFinalShifts, setShowFinalShifts] = useState(false);
  const [userName, setUserName] = useState(""); // ログインユーザーの名前

// 9:00 ～ 21:00 の時間リスト（30分単位）
const timeSlots = Array.from({ length: 25 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);  // 9時からスタート
  const minute = i % 2 === 0 ? "00" : "30"; // 00分か30分
  return `${hour}:${minute}`;
});

  useEffect(() => {
    const shiftsRef = collection(db, "shifts");
  
    // Firestore のデータをリアルタイムで取得
    const unsubscribe = onSnapshot(shiftsRef, (snapshot) => {
      const allShifts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  
      // 🔽 日付順（昇順）にソート
      const sortedShifts = allShifts.sort((a, b) => a.date.localeCompare(b.date));
  
      // 🔽 管理者なら全員のシフトを表示、それ以外は自分のシフトのみ
      const userShifts = isAdmin ? sortedShifts : sortedShifts.filter(shift => shift.user === user.email);
  
      setShifts(userShifts);
    });
  
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminEmails = await fetchAdmins();
      console.log("管理者リスト:", adminEmails); // 🔍 デバッグ用（管理者リストを出力）
      console.log("現在のユーザー:", user?.email); // 🔍 自分のメールアドレスも確認
      setIsAdmin(adminEmails.includes(user?.email)); // 🚀 管理者判定
    };
  
    if (user) checkAdminStatus();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("user");
    onLogout();
  };

  const filteredShifts = isAdmin
  ? shifts.filter(shift => shift.date === selectedDate) // 管理者は選択した日付のシフトを見る
  : shifts; // 一般ユーザーは全員のシフトを一覧表示

  const handleDeleteShift = async (shiftId) => {
    const confirmDelete = window.confirm("このシフトを削除しますか？");
    if (!confirmDelete) return; // キャンセルしたら削除しない
  
    try {
      await deleteDoc(doc(db, "shifts", shiftId)); // Firestore から削除
      setShifts((prevShifts) => prevShifts.filter((shift) => shift.id !== shiftId)); // 画面からも削除
    } catch (error) {
      console.error("エラー:", error);
      alert("シフトの削除に失敗しました");
    }
  };

  // 日付がクリックされたとき
  const handleDateClick = (date) => {
    // 🔽 日本時間での日付フォーマットを使用（UTCのズレを回避）
    const formattedDate = date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-"); // yyyy-mm-dd の形式に変換
  
    setSelectedDate(formattedDate);
  
    // 🔽 すでに登録されているシフトを取得
    const existingShift = shifts.find(shift => shift.date === formattedDate && shift.user === user.email);
  
    if (existingShift) {
      setSelectedTimes(existingShift.times); // 既存のシフトをセット
    } else {
      setSelectedTimes([]); // シフトがなければリセット
    }
  };


    // デバッグ用（状態が更新されたらコンソールに表示）
    useEffect(() => {
      console.log("状態更新:", selectedTimes);
    }, [selectedTimes]);
  

  // 時間ボタンのON/OFFを切り替える
  const toggleTime = (time) => {
    setSelectedTimes((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
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
  
  // 🔽 時間フォーマットを統一する関数（"13.5" → "13:30" に変換）
  const formatTime = (time) => {
    const hour = Math.floor(time);
    const minute = time % 1 === 0.5 ? "30" : "00";
    return `${hour}:${minute}`;
  };

  // シフトを登録
  const handleShiftSubmit = async () => {
    if (!selectedDate || selectedTimes.length === 0) {
      alert("日付と時間を選択してください！");
      return;
    }
  
    try {
      const shiftsRef = collection(db, "shifts");
      const querySnapshot = await getDocs(shiftsRef);
  
      let shiftDocId = null;
  
      // 🔽 Firestore から現在のユーザーのシフトを検索（同じ日付）
      querySnapshot.forEach((doc) => {
        const shiftData = doc.data();
        if (shiftData.date === selectedDate && shiftData.user === user.email) {
          shiftDocId = doc.id; // Firestore のドキュメント ID を取得
        }
      });
  
      if (shiftDocId) {
        // 🔽 Firestore のドキュメントを **新しいデータで上書き**
        await setDoc(doc(db, "shifts", shiftDocId), {
          date: selectedDate,
          times: selectedTimes, // 🔥 ここがポイント！新しい選択リストをそのまま保存
          user: user.email,
        });
      } else {
        // 🔽 Firestore に新規シフトを追加
        await addDoc(shiftsRef, {
          date: selectedDate,
          times: selectedTimes,
          user: user.email,
        });
      }
  
      setSelectedTimes([]); // 選択リセット
    } catch (error) {
      console.error("エラー:", error);
      alert("シフト登録/更新に失敗しました");
    }
  };

  const handleConfirmShift = async () => {
    if (shifts.length === 0) {
      alert("確定するシフトがありません！");
      return;
    }
  
    try {
      await addDoc(collection(db, "finalShifts"), {
        shifts,
        confirmedAt: new Date(),
      });
      alert("シフトを確定しました！");
    } catch (error) {
      console.error("エラー:", error);
      alert("シフト確定に失敗しました");
    }
  };

  const handleAddToFinalShifts = async (shift) => {
    try {
      await addDoc(collection(db, "finalShifts"), {
        date: shift.date,
        times: shift.times,
        user: shift.user,
        displayName: shift.displayName || user.displayName, // 🔥 displayName を保存
        confirmedBy: user.email, // 確定した管理者の情報
        confirmedAt: new Date(),
      });
      alert("シフトを確定版に追加しました！");
    } catch (error) {
      console.error("エラー:", error);
      alert("確定版への追加に失敗しました");
    }
  };

  const [startTime, setStartTime] = useState(null); // 範囲選択の開始時間

  
  const toggleTimeRange = (time) => {
    const timeIdx = timeSlots.indexOf(time);
  
    if (selectedTimes.includes(time)) {
      // 🔹 既に選択されているボタンをタップ → 解除
      setSelectedTimes(selectedTimes.filter((t) => t !== time));
      return;
    }
  
    if (startTime === null) {
      // 🔹 1回目のタップ（新しいスタート）
      setStartTime(time);
      setSelectedTimes([...selectedTimes, time]); // 選択状態にする
    } else {
      const startIdx = timeSlots.indexOf(startTime);
  
      if (timeIdx === startIdx + 1) {
        // 🔥 連続するボタンを押した場合、そのまま追加
        setSelectedTimes([...selectedTimes, time]);
        setStartTime(time);
      } else if (timeIdx > startIdx + 1) {
        // 🔹 未来の時間をタップした場合（範囲選択）
        const newSelection = timeSlots.slice(startIdx, timeIdx + 1);
        setSelectedTimes([...selectedTimes, ...newSelection]);
        setStartTime(null); // スタートリセット
      } else {
        // 🔹 過去の時間をタップした場合、その時間だけ追加（間のボタンは選択しない）
        setSelectedTimes([...selectedTimes, time]);
        setStartTime(time);
      }
    }
  };
  
  // 🔽 すべての選択を解除するボタン
  const clearSelection = () => {
    setSelectedTimes([]);
    setStartTime(null);
  };

  return (
    <div className="relative overflow-hidden mt-4">
      {/* ✅ 共通のヘッダー */}
        <HeaderWithTabs 
          showFinalShifts={showFinalShifts} 
          setShowFinalShifts={setShowFinalShifts} 
          user={user} 
          isAdmin={isAdmin} 
          handleLogout={handleLogout} 
        />

        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(${showFinalShifts ? "-100%" : "0%"})` }}
        >

        {/* 🔽 シフト希望調査のコンテンツ */}
        <div className="w-full flex-shrink-0">
          {/* ✅ 全体を囲むコンテナ */}
            <div className="w-full max-w-screen-2xl mx-auto p-4 border rounded-lg shadow-md bg-white">
              
              {/* 🔽 上段：カレンダー・時間選択・時刻表（横並び） */}
              <div className="flex gap-6 overflow-hidden">
                
                {/* 🔽 左側：カレンダー & 時間選択（w-2/3） */}
                <div className="w-2/3 flex flex-col">
                <h2 className="text-lg font-bold mb-4">シフト希望登録</h2>
                  {/* カレンダー */}
                  <div className="p-4 border rounded shadow-md w-full">
                    <Calendar 
                      onClickDay={handleDateClick}
                      className="w-full h-full"
                      locale="ja-JP"
                    />
                  </div>

                  {/* 時間選択 */}
                  {selectedDate && (
                    <div className="mt-4 p-4 border rounded shadow-md w-full">
                      {/* 🔽 選択時間のタイトル & 選択取消ボタン */}
                      <div className="flex items-center justify-between mt-4 mb-4">
                        <h3 className="text-lg font-bold">選択した日: {selectedDate}</h3>
                        <button
                          onClick={clearSelection}
                          className="w-12 h-12 bg-red-500 text-white flex items-center justify-center rounded"
                        >
                          ✖
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {timeSlots.map((time) => (
                          <button
                            key={time}
                            onClick={() => toggleTimeRange(time)}
                            className={`p-2 rounded w-full ${
                              selectedTimes.includes(time) ? "bg-blue-500 text-white" : "bg-gray-200"
                            }`}
                          >
                            {time}〜
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleShiftSubmit}
                        className="mt-4 bg-green-500 text-white p-2 rounded w-full"
                      >
                        シフト登録
                      </button>
                    </div>
                  )}
                </div>

                {/* 🔽 右側：時刻表（w-1/3） */}
                <div className="border-l pl-6 min-w-[220px] w-1/3">
                  <h3 className="font-bold mb-2">{selectedDate}</h3>
                  <div className="relative left-10 w-full h-[600px]">
                    {timeSlots.map((time, index) => (
                      <div key={time} className="relative flex items-center h-[30px]">
                                
                        <span className="absolute -left-8 text-sm">{time}</span>
                        <div className="absolute left-10 top-3 w-full h-[1px] bg-gray-400"></div>
                        <div
                          className={`absolute left-10 top-3 w-full h-[30px] transition cursor-pointer ${
                            selectedTimes.includes(time) ? "bg-green-500 opacity-50" : "bg-transparent"
                          }`}
                          onClick={() => toggleTimeRange(time)}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>

              </div> {/* 🔚 上段（カレンダー＆時間選択＆時刻表） */}

              {/* 🔽 下段：登録済みのシフト一覧（w-full） */}
              <div className="w-full max-w-screen-2xl mx-auto px-4 mt-6">
                <h3 className="font-bold mt-4">
                  {isAdmin && selectedDate ? `${selectedDate} のシフト一覧` : "登録済みのシフト"}
                </h3>
                <ul className="w-full">
                  {filteredShifts.map((shift) => {
                    const groupedTimes = groupConsecutiveTimes(shift.times);

                    return (
                      <li
                        key={shift.id}
                        onClick={() => handleDateClick(new Date(shift.date))}
                        className="border p-2 my-2 shadow-sm flex flex-wrap items-center gap-4 w-full max-w-screen-2xl cursor-pointer hover:bg-gray-100 transition"
                      >
                        {/* 管理者なら名前を表示 */}
                        {isAdmin && <span className="text-sm text-gray-600 min-w-[150px]">{user?.displayName}</span>}
                        {/* 一般ユーザーなら日付を表示 */}
                        {!isAdmin && <span className="min-w-[100px]">{shift.date}</span>}
                        {/* 時間帯 */}
                        <span className="flex-1 whitespace-normal break-words">{groupedTimes.join(", ")}</span>

                        {/* 🔽 確定ボタン（管理者のみ表示） */}
                        {isAdmin && (
                          <button
                            onClick={() => handleAddToFinalShifts(shift)}
                            className="bg-blue-500 text-white p-2 rounded text-sm min-w-[100px] text-center"
                          >
                            確定
                          </button>
                        )}
                        {/* 🔽 削除ボタン（ユーザー本人のみ） */}
                        {user.email === shift.user && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteShift(shift.id);
                            }}
                            className="bg-red-500 text-white p-2 rounded text-sm min-w-[80px] text-center"
                          >
                            削除
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

            </div>
        </div>

        {/* 🔽 確定版シフトのコンテンツ（FinalShifts.js を適用） */}
        <div className="w-full flex-shrink-0">
          <FinalShifts user={user} />
        </div>
  </div>
</div>

 
  );
}