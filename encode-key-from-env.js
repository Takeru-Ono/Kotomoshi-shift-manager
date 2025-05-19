// encode-key-from-env.js
// 明示的に .env.local を指定する
require("dotenv").config({ path: ".env.local" });

const raw = process.env.FIREBASE_PRIVATE_KEY;

if (!raw) {
    console.error("❌ FIREBASE_PRIVATE_KEY が .env.local にありません");
    process.exit(1);
}

const restored = raw.replace(/\\n/g, '\n');
const base64 = Buffer.from(restored).toString("base64");

console.log("✅ 以下の Base64 を Vercel に貼ってください：\n");
console.log(base64);