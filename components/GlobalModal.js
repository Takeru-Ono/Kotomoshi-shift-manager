import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

export default function GlobalModal({ isOpen, onClose, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[99999]">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative z-[100000]">
        {children}

        {/* 🔽 閉じるボタン */}
        <button
          onClick={onClose}
          className="mt-2 bg-gray-500 text-white p-2 rounded w-full"
        >
          キャンセル
        </button>
      </div>
    </div>,
    document.getElementById("modal-root") // 🔥 `modal-root` に描画
  );
}