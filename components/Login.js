import { useState, useEffect } from "react";
import { auth, provider, fetchAllowedUsers, fetchAdmins } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

export default function Login({ onLogin }) {
  const [user, setUser] = useState(null);
  const [isAllowed, setIsAllowed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log("✅ ログイン中のユーザー:", currentUser.email);
        setUser(currentUser);
        onLogin(currentUser);

        // ✅ Firestore の `allowedUsers` を取得
        const allowedUsers = await fetchAllowedUsers();
        const adminEmails = await fetchAdmins();

        if (!allowedUsers.includes(currentUser.email)) {
          console.warn("🚨 許可されていないユーザー:", currentUser.email);
          alert("このアカウントではログインできません 🚫");
          await signOut(auth);
          setUser(null);
          setIsAllowed(false);
          return;
        }

        setIsAllowed(adminEmails.includes(currentUser.email));
      } else {
        setUser(null);
        setIsAllowed(false);
      }
    });

    return () => unsubscribe();
  }, [onLogin]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider.setCustomParameters({
        prompt: "select_account" 
      }));

      if (!result || !result.user) {
        throw new Error("ログインに失敗しました。");
      }
      await result.user.getIdToken(true);

      const currentUser = result.user;
      setUser(currentUser);
      onLogin(currentUser);

      // ✅ 許可ユーザーリスト取得
      const allowedUsers = await fetchAllowedUsers();
      const adminEmails = await fetchAdmins();

      if (!allowedUsers.includes(currentUser.email)) {
        alert("このアカウントではログインできません 🚫");
        await signOut(auth);
        setError("このアカウントではログインできません");
        return;
      }

      setIsAllowed(adminEmails.includes(currentUser.email));
      setError(null);
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
        isAllowed ? (
          <div>
            <p>ログイン中: {user.displayName} ({user.email})</p>
            <button onClick={() => signOut(auth)} className="bg-red-500 text-white p-2 rounded mt-2">
              ログアウト
            </button>
          </div>
        ) : (
          <p className="text-red-500 font-bold">許可されていないアカウントです</p>
        )
      ) : (
<div className="flex justify-end">
  <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded">
    Googleでログイン
  </button>
</div>
      )}
    </div>
  );
}