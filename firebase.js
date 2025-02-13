import { getFirestore, collection, getDocs } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ✅ Firebase アプリを初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ✅ Firestore から許可ユーザーリストを取得
export const fetchAllowedUsers = async () => {
  const snapshot = await getDocs(collection(db, "allowedUsers"));
  return snapshot.docs.map((doc) => doc.id); // 🔥 メールアドレスをリストとして返す
};

// ✅ Firestore から管理者リストを取得
export const fetchAdmins = async () => {
  const snapshot = await getDocs(collection(db, "admins"));
  return snapshot.docs.map((doc) => doc.id);
};

export { auth, provider, db };