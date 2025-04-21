import { getFirestore, collection, getDocs } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// console.log("Firebase API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
// console.log("Firebase Auth Domain:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
// console.log("Firebase Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

// ✅ Firebase 初期化
// console.log("Firebase 初期化開始");
const app = initializeApp(firebaseConfig);
// console.log("Firebase 初期化成功");
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const isDev = process.env.NODE_ENV === "development";

// ✅ Firestore から `allowedUsers` を取得
export const fetchAllowedUsers = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn("🚨 `auth.currentUser` が null です！");
      return [];
    }

    console.log("✅ Firestore へのリクエストを送信:", currentUser.email);

    const snapshot = await getDocs(collection(db, "allowedUsers"));
    
    const allowedUsers = snapshot.docs.map((doc) => doc.data().email);
    if (isDev) console.log("✅ 許可ユーザー取得成功:", allowedUsers);

    return allowedUsers;
  } catch (error) {
    console.error("🔥 Firestore `allowedUsers` 取得エラー:", error);
    return [];
  }
};

export const fetchAdmins = async () => {
  try {
    console.log("🔍 Firestore から `admins` を取得...");
    const snapshot = await getDocs(collection(db, "admins"));
    
    // `email` フィールドの値だけを取得（自動生成IDは不要）
    const admins = snapshot.docs.map((doc) => doc.data().email);

    if (isDev) console.log("✅ 管理者取得成功:", admins);
    return admins;
  } catch (error) {
    console.error("🔥 Firestore `admins` 取得エラー:", error);
    return [];
  }
};

export { auth, provider, db};