const HeaderWithTabs = ({ showFinalShifts, setShowFinalShifts, user, isAdmin, handleLogout }) => {

    const toggleSwitch = () => {
        setShowFinalShifts((prev) => !prev); // 🔥 現在の状態を反転（トグル切り替え）
      };


    return (
      <div className="flex items-center justify-between w-full gap-8 border-b pb-4">
      
      {/* 🔽 スイッチ風タブ */}
      <div 
        className="relative w-[200px] h-[40px] bg-gray-300 rounded-full flex items-center p-1 cursor-pointer overflow-hidden"
        onClick={toggleSwitch}
      >
        {/* 🔽 スライダー部分（背景色を半透明 & mix-blend-mode を適用） */}
        <div
          className={`absolute top-0 left-0 h-full w-1/2 bg-green-500 rounded-full transition-all duration-300 pointer-events-none ${
            showFinalShifts ? "translate-x-full" : "translate-x-0"
          }`}
        ></div>
        
        {/* 🔽 シフト希望調査（`z-index` を設定して前面に） */}
        <div
          className={`w-1/2 text-center text-sm font-bold transition-all duration-300 relative z-10 ${
            !showFinalShifts ? "text-white" : "text-gray-700"
          }`}
        >
          シフト希望
        </div>

        {/* 🔽 確定版シフト（`z-index` を設定して前面に） */}
        <div
          className={`w-1/2 text-center text-sm font-bold transition-all duration-300 relative z-10 ${
            showFinalShifts ? "text-white" : "text-gray-700"
          }`}
        >
          確定版
        </div>
      </div>

  
        {/* 🔽 右側: 管理者情報 & ログアウトボタン */}
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-lg text-white ${isAdmin ? "bg-red-500" : "bg-blue-500"}`}>
            {isAdmin ? "管理者" : "一般"}
          </span>
          <span className="text-sm text-gray-700">{user?.displayName || "ゲスト"} さん</span>
          <button onClick={handleLogout} className="bg-red-500 text-white p-2 rounded">
            ログアウト
          </button>
        </div>
      </div>
    );
  };
  
  export default HeaderWithTabs;