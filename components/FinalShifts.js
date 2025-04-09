import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc, onSnapshot, addDoc } from "firebase/firestore";
import { db, fetchAdmins } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import todayEvents from "../data/todayEvents"; // ✅ データファイルをインポート
import GlobalModal from "../components/GlobalModal";
import { updateDoc } from "firebase/firestore";





export default function FinalShifts({ user }) {
  const [finalShifts, setFinalShifts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateShifts, setSelectedDateShifts] = useState([]);
  const [todayInfo, setTodayInfo] = useState("");
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]); // ✅ ユーザーリストを保存する State
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [editedTimes, setEditedTimes] = useState([]);
  const [adminComment, setAdminComment] = useState("");
  const [startTime, setStartTime] = useState(null); // 範囲選択の開始時間


  const timeSlots = Array.from({ length: 25 }, (_, i) => {
    const hour = 9 + Math.floor(i / 2);  // 9時からスタート
    const minute = i % 2 === 0 ? "00" : "30"; // 00分か30分
    return `${hour}:${minute}`;
  });
  const [isAdmin, setIsAdmin] = useState(false);


  useEffect(() => {
    const fetchAllowedUsers = async () => {
      try {
        console.log("🔍 Firestore から `allowedUsers` を取得開始..."); // 🔍 デバッグログ
  
        const snapshot = await getDocs(collection(db, "allowedUsers")); // Firestore の `allowedUsers` コレクションを取得
  
        const users = snapshot.docs.map((doc) => ({
          email: doc.data().email, // ユーザーのメールアドレス
          displayName: doc.data().displayName || doc.data().email, // `displayName` が無い場合は `email` を代わりに使う
        }));
  
        console.log("✅ `allowedUsers` 取得成功:", users); // 🔍 デバッグログ
        setRegisteredUsers(users); // ✅ State に格納
  
      } catch (error) {
        console.error("❌ 許可ユーザーの取得に失敗:", error);
      }
    };
  
    fetchAllowedUsers();
  }, []);


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
  const getUserColor = (userEmail) => {
    const hash = Array.from(userEmail).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = (hash % 330) + 30; // 30〜360の間で色相を生成（赤を除外）
    return `hsl(${hue}, 70%, 60%)`; // 彩度と明度を調整
  };



const getTodayInfo = (date) => {
  const formattedDate = date.toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, "-");

  return todayEvents[formattedDate] || { title: "??", description: "今日は特に記念日はありません" };
};

  const handleDateClick = (date) => {
    const formattedDate = date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    setSelectedDate(formattedDate);
    setTodayInfo(getTodayInfo(date));
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

const handleAddFinalShift = async () => {
  if (!selectedUser || selectedTimes.length === 0) {
    alert("ユーザーと時間を選択してください！");
    return;
  }

  try {
    // 🔍 Firestore から既存の確定シフトを取得
    const snapshot = await getDocs(collection(db, "finalShifts"));
    const existingShifts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 🔍 既に同じ `user` & `date` で登録されたシフトがあるか確認
    const isDuplicate = existingShifts.some(shift =>
      shift.user === selectedUser && shift.date === selectedDate
    );

    if (isDuplicate) {
      alert("このユーザーはすでにこの日にシフト登録されています。");
      return;
    }

    // 🔥 `displayName` を取得
    const selectedUserData = registeredUsers.find(user => user.email === selectedUser);
    const displayName = selectedUserData ? selectedUserData.displayName : selectedUser;

    // 🔽 Firestore に新規シフトを追加（**user はメールアドレスに統一！**）
    await addDoc(collection(db, "finalShifts"), {
      user: selectedUser, // ✅ **ここをメールアドレスにする！**
      displayName: displayName, // ✅ `displayName` はそのまま保持
      date: selectedDate,
      times: selectedTimes,
      confirmedAt: new Date(),
      confirmedBy: user.email
    });

    alert("確定版シフトを追加しました！");

    // 🔽 追加後に一覧を更新する
    setFinalShifts(prev => [
      ...prev,
      {
        id: "temp-" + new Date().getTime(),
        user: selectedUser, // ✅ ここもメールアドレスに統一
        displayName: displayName,
        date: selectedDate,
        times: selectedTimes,
        confirmedAt: new Date(),
        confirmedBy: user.email
      }
    ]);

    // 🔽 モーダルを閉じる
    setShowAddShiftModal(false);
  } catch (error) {
    console.error("エラー:", error);
    alert("シフトの追加に失敗しました。");
  }
};

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

const handleEditShift = (shift) => {
  setEditingShift(shift);
  setEditedTimes(shift.times); // 既存の時間をセット
  setAdminComment(shift.adminComment || ""); // 既存コメントをセット
  setShowEditShiftModal(true);
};

const handleSaveShiftEdit = async () => {
  if (!editingShift) return;

  try {
    const shiftRef = doc(db, "finalShifts", editingShift.id);
    await updateDoc(shiftRef, {
      times: editedTimes,
      adminComment: adminComment,
    });

    alert("シフトを更新しました！");

    // 🔽 編集モーダルを閉じる（Firestoreのリアルタイムリスナーが反映してくれる）
    setShowEditShiftModal(false);
  } catch (error) {
    console.error("エラー:", error);
    alert("シフトの更新に失敗しました。");
  }
};

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

const handleSendToDiscord = async () => {
  const currentMonth = new Date().toISOString().slice(0, 7); // 現在の月 (例: "2025-04")

  try {
    const response = await fetch("http://localhost:3000/send-discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: currentMonth, shifts: finalShifts }),
    });

    if (response.ok) {
      alert("Discordに送信しました！");
    } else {
      alert("Discord送信に失敗しました。");
    }
  } catch (error) {
    console.error("エラー:", error);
    alert("Discord送信に失敗しました。");
  }
};

return (
  <div className="relative w-full max-w-screen-2xl mx-auto p-4 border rounded-lg shadow-md bg-white">
    
    {/* 🔽 上段：カレンダー & 時刻表 */}
    <div className="flex gap-6 overflow-hidden">
      
      {/* 🔽 カレンダー (w-2/3) */}
      <div className="w-full md:w-1/2 flex flex-col">
        <h2 className="text-lg font-bold mb-4">確定版シフト</h2>

        <div className="p-4 border rounded shadow-md w-full">
          <Calendar 
            tileContent={tileContent} 
            onClickDay={handleDateClick} 
            className="w-full h-full"
            locale="ja-JP"
          />
        </div>

        {/* 🔽 下段：確定版シフトリスト */}
        {selectedDate && (
          <div className="w-full mt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">
                {selectedDate}
                <span className="text-sm font-normal ml-2">
                  {todayInfo.title && ` は${todayInfo.title} `}
                </span>
              </h3>


            </div>

            <h3 className="font-bold mt-4">確定シフト一覧</h3>
            <ul className="w-full">
              {selectedDateShifts.map((shift) => {
                const groupedTimes = groupConsecutiveTimes(shift.times);
                return (
                  <li
                    key={shift.id}
                    className="border p-2 my-2 shadow-sm flex flex-wrap items-center gap-4 w-full cursor-pointer hover:bg-gray-100 transition"
                  >
                    {/* ✅ ユーザー名 */}
                    <span className="text-sm text-gray-600 min-w-[150px]">
                      {shift.displayName || shift.user}
                    </span>
                    
                    {/* ✅ 時間帯 */}
                    <span className="flex-1 whitespace-normal break-words">
                      {groupedTimes.join(", ")}
                    </span>

                    {/* ✅ 管理者コメントがあれば表示 */}
                    {shift.adminComment && (
                      <span className="text-xs text-gray-500">{shift.adminComment}</span>
                    )}

                    {/* 🔽 編集ボタン（管理者のみ） */}
                    {isAdmin && (
                      <button
                        onClick={() => handleEditShift(shift)}
                        className="bg-yellow-500 text-white p-1 rounded text-sm min-w-[80px] text-center"
                      >
                        編集
                      </button>
                    )}

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
      {isAdmin && (
          <button
          onClick={() => {
            const currentMonth = new Date().toISOString().slice(0, 7); // 現在の月 (例: "2025-04")
            handleSendToDiscord();
          }}
            className="mb-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
          >
            この月のシフトをDiscordに送る
          </button>
        )}
        <h3 className="font-bold mb-2">{selectedDate}</h3>
        <div className="relative left-10 w-full h-[770px]">
          {timeSlots.map((time) => {
            const shiftsAtTime = selectedDateShifts.filter(shift => shift.times.includes(time));

            return (
              <div key={time} className="relative flex items-center h-[30px] cursor-pointer">
                {/* 時間ラベル */}
                <span className="absolute -left-8 text-sm">{time}</span>

                {/* 時間を区切る線 */}
                <div className="absolute left-[60px] top-3 w-full h-[1px] bg-gray-400 transform -translate-y-1/2"></div>

                {/* 🔽 複数人のシフトを 20% 幅で配置 */}
                {shiftsAtTime.map((shift, shiftIndex) => {
                  const shiftWidth = "20%"; 
                  const shiftLeft = `calc(60px + ${shiftIndex * 20}%)`; 

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

   {/* 🔽 モーダルの内容をアプリ全体の `GlobalModal` に渡す */}
{showAddShiftModal && (
  <GlobalModal isOpen={showAddShiftModal} onClose={() => setShowAddShiftModal(false)}>
    <h3 className="text-xl font-bold mb-4">確定版シフトを追加</h3>

    {/* ユーザー選択 */}
    <select
      className="p-2 border rounded w-full"
      value={selectedUser}
      onChange={(e) => setSelectedUser(e.target.value)}
    >
      <option value="">ユーザーを選択</option>
      {registeredUsers.map((user, index) => (
        <option key={user.email || index} value={user.email}>
          {user.displayName}
        </option>
      ))}
    </select>

    {/* 時間選択 */}
    <div className="grid grid-cols-4 gap-2 mt-2">
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

    {/* シフト登録ボタン */}
    <button
      onClick={handleAddFinalShift}
      className="mt-4 bg-green-500 text-white p-2 rounded w-full"
    >
      シフトを確定版に登録
    </button>
  </GlobalModal>
)}

{showEditShiftModal && (
  <GlobalModal isOpen={showEditShiftModal} onClose={() => setShowEditShiftModal(false)}>
    <h3 className="text-xl font-bold mb-4">確定版シフトを編集</h3>

    {/* 🔽 時間選択 */}
    <div className="grid grid-cols-4 gap-2 mt-2">
      {timeSlots.map((time) => (
        <button
          key={time}
          onClick={() =>
            setEditedTimes((prev) =>
              prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
            )
          }
          className={`p-2 rounded w-full ${
            editedTimes.includes(time) ? "bg-blue-500 text-white" : "bg-gray-200"
          }`}
        >
          {time}〜
        </button>
      ))}
    </div>

    {/* 🔽 管理者コメント入力 */}
    <textarea
      className="p-2 border rounded w-full mt-2"
      placeholder="管理者コメントを入力..."
      value={adminComment}
      onChange={(e) => setAdminComment(e.target.value)}
    ></textarea>

    {/* 🔽 保存ボタン */}
    <button
      onClick={handleSaveShiftEdit}
      className="mt-4 bg-green-500 text-white p-2 rounded w-full"
    >
      シフトを更新
    </button>

  </GlobalModal>
)}
  </div>
);
}