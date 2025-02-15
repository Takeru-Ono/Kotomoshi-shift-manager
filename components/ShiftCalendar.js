import { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db, fetchAdmins, auth } from "../firebase";
import { signOut } from "firebase/auth";
import FinalShifts from "./FinalShifts";
import HeaderWithTabs from "./HeaderWithTabs";
import { collection, addDoc, getDocs, onSnapshot, setDoc, doc, deleteDoc } from "firebase/firestore";
import todayEvents from "../data/todayEvents"; // ✅ データファイルをインポート

export default function ShiftCalendar({ user, onLogout }) {
    // 🔹 ステート管理
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimes, setSelectedTimes] = useState([]); // 選択した時間を保存
  const [shifts, setShifts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFinalShifts, setShowFinalShifts] = useState(false);
  const [todayInfo, setTodayInfo] = useState("");
  const [memo, setMemo] = useState(""); // 🔥 メモのステートを追加

// 9:00 ～ 21:00 の時間リスト（30分単位）
const timeSlots = Array.from({ length: 25 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);  // 9時からスタート
  const minute = i % 2 === 0 ? "00" : "30"; // 00分か30分
  return `${hour}:${minute}`;
});

  // 🔹 今日の日付（YYYY-MM-DD 形式）
  const today = new Date();
  const formattedToday = today.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, "-");

useEffect(() => {

  const shiftsRef = collection(db, "shifts");

  // Firestore のデータをリアルタイムで取得
  const unsubscribe = onSnapshot(shiftsRef, (snapshot) => {
    const allShifts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 🔽 日付順（昇順）にソート
    const sortedShifts = allShifts.sort((a, b) => a.date.localeCompare(b.date));

    // 🔽 ユーザーの権限に応じたデータフィルタリング
    const filteredShifts = isAdmin
      ? sortedShifts.filter(shift => shift.date === selectedDate) // 🔹 管理者は選択した日付のシフトのみ表示
      : sortedShifts.filter(shift => shift.user === user.email && shift.date >= formattedToday); // 🔹 一般ユーザーは自分のシフトのみ表示

    setShifts(filteredShifts);
  });

  return () => {
    
    unsubscribe();
  };
}, [user, isAdmin, selectedDate, formattedToday]); // ✅ `user`, `isAdmin`, `selectedDate` が変わるたびに更新

  /** 🔽 管理者かどうかを判定 */
  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminEmails = await fetchAdmins();

      setIsAdmin(adminEmails.includes(user?.email)); // 🚀 管理者判定
    };
  
    if (user) checkAdminStatus();
  }, [user]);


  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("user");
    onLogout();
  };

    /** 🔽 シフトデータをユーザー権限ごとにフィルタリング */
  const filteredShifts = isAdmin
  ? shifts.filter(shift => shift.date === selectedDate) // 管理者は選択した日付のシフトを表示
  : shifts.filter(shift => shift.user === user.email && shift.date >= formattedToday); 

   /** 🔽 シフト削除 */
  const handleDeleteShift = async (shiftId) => {
    const confirmDelete = window.confirm("このシフトを削除しますか？");
    if (!confirmDelete) return; // キャンセルしたら削除しない
  
    try {
      await deleteDoc(doc(db, "shifts", shiftId)); // Firestore から削除
      setShifts((prevShifts) => prevShifts.filter((shift) => shift.id !== shiftId)); // 画面からも削除
    } catch (error) {
      console.error("🚨 ログインエラー:", error); 
      alert("シフトの削除に失敗しました");
    }
  };

  // const fetchTodayInfo = async (date) => {
  //   try {
  //     const response = await fetch(`https://today-in-history-api.com/${date}`);
  //     const data = await response.json();
  //     return data.description; // 例: "今日は○○の日！"
  //   } catch (error) {
  //     console.error("データ取得エラー:", error);
  //     return "？？";
  //   }
  // };

  const getTodayInfo = (date) => {
    const formattedDate = date.toLocaleDateString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-");
  
    return todayEvents[formattedDate] || { title: "??", description: "今日は特に記念日はありません" };
  };

  // 日付がクリックされたとき
  const handleDateClick = async (date) => {
    // 🔽 日本時間での日付フォーマットを使用（UTCのズレを回避）
    const formattedDate = date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-"); // yyyy-mm-dd の形式に変換
  
    setSelectedDate(formattedDate);
  
    setTodayInfo(getTodayInfo(date));
  
    // 🔽 すでに登録されているシフトを取得
    const existingShift = shifts.find(shift => shift.date === formattedDate && shift.user === user.email);
  
    if (existingShift) {
      setSelectedTimes(existingShift.times); // 既存のシフトをセット
    } else {
      setSelectedTimes([]); // シフトがなければリセット
    }
  };

    // デバッグ用（状態が更新されたらコンソールに表示）

    // useEffect(() => {
    //   console.log("状態更新:", selectedTimes);
    // }, [selectedTimes]);
  

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

  
today.setHours(0, 0, 0, 0); // 時刻を 00:00:00 にリセット（純粋な日付比較のため）

// 🔹 現在の日付より未来 or 今日のシフトのみ表示
// const PastShifts = shifts.filter((shift) => {
//   const shiftDate = new Date(shift.date); // シフトの日付を取得
//   shiftDate.setHours(0, 0, 0, 0); // 時刻を 00:00:00 にリセット

//   return shiftDate >= today; // 今日以降のシフトだけを表示
// });

  // シフトを登録
  const handleShiftSubmit = async () => {
    if (!selectedDate || selectedTimes.length === 0) {
      alert("日付と時間を選択してください!！");
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
          memo: memo,
        });
      } else {
        // 🔽 Firestore に新規シフトを追加
        await addDoc(shiftsRef, {
          date: selectedDate,
          times: selectedTimes,
          user: user.email,
          memo: memo,
        });
      }
  
      setSelectedTimes([]); // 選択リセット
      setMemo("");
    } catch (error) {
      console.error("エラー:", error);
      alert("シフト登録/更新に失敗しました");
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
                      {/* 🔹 選択時間のタイトル & 選択取消ボタン */}
                      <div className="flex items-center justify-between mb-4 ml-10">
                        {/* 🔹 左側に日付とタイトル */}
                        <div className="flex flex-col">
                          <h3 className="text-2xl font-bold">
                            {selectedDate}
                            <span className="text-sm font-normal ml-2">
                              {todayInfo.title && ` は${todayInfo.title} `}
                            </span>
                          </h3>
                          {/* 🔹 その下に説明を小さめのフォントで表示 */}
                          {todayInfo.description && (
                            <p className="text-xs text-gray-600 mt-1">{todayInfo.description}</p>
                          )}
                        </div>

                        {/* 🔹 ばつボタンは右側に固定 */}
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
                      {/* 🔽 メモ入力エリア */}
                      <textarea
                        className="w-full p-2 border rounded mt-2"
                        placeholder="メモを入力"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                      ></textarea>
                      <button
                        onClick={handleShiftSubmit}
                        className="mt-4 bg-green-500 text-white p-2 rounded w-full"
                      >
                        シフト希望登録
                      </button>
                    </div>
                  )}
                </div>

                {/* 🔽 右側：時刻表（w-1/3） */}
                <div className="border-l pl-6 min-w-[220px] w-1/3">
                  <h3 className="font-bold mb-2">{selectedDate}</h3>
                  <div className="relative left-10 w-full h-[600px]">
                    {timeSlots.map((time) => (
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
                        {/* 🔽 メモを表示 */}
                        {shift.memo && (
                          <span className="text-gray-600 text-sm italic ml-4">📝 {shift.memo}</span>
                        )}
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