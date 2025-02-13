import { useState, useEffect } from "react";
import { auth, provider, fetchAdmins, fetchAllowedUsers } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

export default function Login({ onLogin }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        onLogin(currentUser);

        // 🔹 Firestore から管理者リストと許可ユーザーリストを取得
        const adminEmails = await fetchAdmins();
        const allowedUsers = await fetchAllowedUsers();

        // 🔹 許可ユーザーでなければログアウト
        if (!allowedUsers.includes(currentUser.email)) {
          alert("このアカウントではログインできません 🚫");
          await handleLogout();
          setError("このアカウントではログインできません");
          return;
        }

        // 🔹 管理者チェック
        setIsAdmin(adminEmails.includes(currentUser.email));
        setError(null);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      setUser(currentUser);
      onLogin(currentUser);

      // 🔹 Firestore から許可ユーザーリストを取得
      const allowedUsers = await fetchAllowedUsers();

      if (!allowedUsers.includes(currentUser.email)) {
        alert("このアカウントではログインできません 🚫");
        await handleLogout();
        setError("このアカウントではログインできません");
        return;
      }

      // 🔹 Firestore から管理者リストを取得
      const adminEmails = await fetchAdmins();
      setIsAdmin(adminEmails.includes(currentUser.email));
      setError(null);
    } catch (error) {
      console.error("ログインエラー:", error);
      alert("ログインに失敗しました ❌");
      setError("ログインに失敗しました");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem("user");
    onLogin(null);
  };

  return (
    <div className="p-4 border rounded shadow-md">
      {error && <p className="text-red-500 font-bold">{error}</p>}

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