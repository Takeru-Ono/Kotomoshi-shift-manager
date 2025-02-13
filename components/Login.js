import { useState, useEffect } from "react";
import { auth, provider, fetchAdmins } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

export default function Login({ onLogin }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        onLogin(currentUser);

        // Firestoreから管理者リストを取得
        const adminEmails = await fetchAdmins();
        setIsAdmin(adminEmails.includes(currentUser.email));
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
  }, []);

  // Googleログイン処理
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      onLogin(result.user);

      // 管理者チェック
      const adminEmails = await fetchAdmins();
      setIsAdmin(adminEmails.includes(result.user.email));
    } catch (error) {
      console.error("ログインエラー:", error);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem("user"); // ログイン情報を削除
    onLogin(null);
  };

  return (
    <div className="p-4 border rounded shadow-md">
      {user ? (
        <div>
          <p>ログイン中: {user.displayName} ({user.email})</p>
          {isAdmin && <p className="text-red-500 font-bold">管理者権限あり</p>}
          <button onClick={handleLogout} className="bg-red-500 text-white p-2 rounded mt-2">
            ログアウト
          </button>
        </div>
      ) : (
        <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded">
          Googleでログイン
        </button>
      )}
    </div>
  );
}