import { useState, useEffect, useCallback } from "react";
import { auth, provider, fetchAdmins, fetchAllowedUsers } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

export default function Login({ onLogin }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);

  // 🔹 デバッグログを追加してエラーの原因を特定
  // console.log("✅ Login.js: コンポーネントがマウントされました");

  const handleLogout = useCallback(async () => {
    // console.log("✅ handleLogout が呼ばれました");
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem("user");
    onLogin(null);
  }, [onLogin]);

  useEffect(() => {
    // console.log("✅ useEffect が実行されました");
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // console.log("✅ ログイン中のユーザー:", currentUser.email);
        setUser(currentUser);
        onLogin(currentUser);

        try {
          // console.log("✅ Firestore から管理者リストと許可ユーザーリストを取得します");
          const adminEmails = await fetchAdmins();
          const allowedUsers = await fetchAllowedUsers();
          
          if (!allowedUsers.includes(currentUser.email)) {
            // console.warn("🚨 許可されていないユーザーがログイン:", currentUser.email);
            alert("このアカウントではログインできません 🚫");
            await handleLogout();
            setError("このアカウントではログインできません");
            return;
          }

          setIsAdmin(adminEmails.includes(currentUser.email));
          setError(null);
        } catch (fetchError) {
          console.error("🚨 Firestore データ取得中のエラー:", fetchError);
          setError("ユーザー情報の取得に失敗しました");
        }
      } else {
        // console.warn("⛔ ユーザーがログインしていません");
        setUser(null);
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, [handleLogout, onLogin]);

  const handleLogin = async () => {
    try {
      // console.log("🔹 ログイン処理を開始します");

      const result = await signInWithPopup(auth, provider.setCustomParameters({
        prompt: "select_account" // ← ✅ 毎回アカウント選択画面を表示
      }));

      if (!result || !result.user) {
        throw new Error("ログインに失敗しました。ユーザー情報が取得できません。");
      }

      const currentUser = result.user;
      setUser(currentUser);
      onLogin(currentUser);
      // console.log("✅ ユーザー情報を取得:", currentUser.email);

      const allowedUsers = await fetchAllowedUsers();
      // console.log("✅ 許可ユーザーリスト取得:", allowedUsers);

      if (!allowedUsers.includes(currentUser.email)) {
        alert("このアカウントではログインできません 🚫");
        await handleLogout();
        setError("このアカウントではログインできません");
        // console.warn("⛔ 許可されていないユーザー:", currentUser.email);
        return;
      }

      const adminEmails = await fetchAdmins();
      setIsAdmin(adminEmails.includes(currentUser.email));
      setError(null);
      // console.log("✅ 管理者判定:", adminEmails.includes(currentUser.email));
    } catch (error) {
      console.error("🚨 ログインエラー:", error);
      alert("ログインに失敗しました ❌");
      setError("ログインに失敗しました");
    }
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