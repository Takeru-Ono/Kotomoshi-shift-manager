# Shift Manager

Next.js (Vercel) をフロントエンドに、Firebase をバックエンドに使うシフト管理アプリです。確定シフトを Firestore に保存し、Firebase Functions から Google スプレッドシートや Discord へ連携します。

## 必要なディレクトリと役割

- `pages/` & `components/` – Next.js フロントエンド
- `backend/` – Functions / Next API 双方で共有するサーバーサイドロジック
- `functions/` – Firebase Functions のエントリポイント
- `lib/` – サーバーサイド util（Firebase Admin 初期化など）

## 必要な環境変数

`.env.local`（ローカル開発用）と Vercel / Firebase Functions の環境に同じキーを設定します。関係する値は [encode-key-from-env.js](encode-key-from-env.js) で Base64 変換できます。

| 変数名 | 用途 | 備考 |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクト ID | Next.js から Functions の URL 組み立てにも利用 |
| `FIREBASE_PRIVATE_KEY_B64` または `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK 用 | フロント側で Functions を使う場合は必須ではありません |
| `FIREBASE_CLIENT_EMAIL` ほか Firebase Admin 用の各種キー | Firebase Admin 初期化に使用 | 同上 |
| `GOOGLE_CLIENT_EMAIL` | Google Sheets サービスアカウント | Functions 側は Secret として登録 |
| `GOOGLE_PRIVATE_KEY_B64` (推奨) | Google Sheets サービスアカウント鍵 | 改行は `encode-key-from-env.js` で変換 |
| `SPREADSHEET_ID` | 連携先スプレッドシート ID | Functions Secret 推奨 |
| `DISCORD_WEBHOOK_URL` | Discord 送信用 Webhook | Functions Secret 推奨 |
| `FIREBASE_FUNCTIONS_REGION` | Functions デプロイリージョン | 既定: `asia-northeast1` |
| `FIREBASE_FUNCTIONS_BASE_URL` | （任意）Functions の完全なベース URL | 指定しなければ `https://{region}-{project}.cloudfunctions.net` を使用 |
| `FUNCTIONS_ALLOWED_ORIGINS` | CORS 許可ドメインのカンマ区切り | 例: `https://your-app.vercel.app` |
| `USE_FIREBASE_FUNCTIONS` | Next API から Cloud Functions を強制利用 | 通常は不要。自動判定が動かない場合に `true` |

## ローカル開発

1. 依存関係をインストール
   ```bash
   npm install
   ```
2. `.env.local` を作成し、上表の値を設定
3. フロントエンドを起動
   ```bash
   npm run dev
   ```
4. Functions をローカルで使う場合は Firebase Emulator を起動し、`FIREBASE_FUNCTIONS_BASE_URL` を `http://127.0.0.1:5001/<project-id>/<region>` に設定してください。

## Firebase Functions のセットアップ

1. Firebase CLI をインストールしログイン
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use <project-id>
   ```
2. Functions 依存関係をインストール
   ```bash
   npm install --prefix functions
   ```
3. Secret を登録（Secret Manager を利用）
   ```bash
   firebase functions:secrets:set GOOGLE_CLIENT_EMAIL
   firebase functions:secrets:set GOOGLE_PRIVATE_KEY_B64
   firebase functions:secrets:set SPREADSHEET_ID
   firebase functions:secrets:set DISCORD_WEBHOOK_URL
   # 必要に応じて
   firebase functions:secrets:set FUNCTIONS_ALLOWED_ORIGINS
   ```
   ※ 値はプロンプトに貼り付けます。`FUNCTIONS_ALLOWED_ORIGINS` はカンマ区切りで複数設定できます。
4. Functions をデプロイ
   ```bash
   firebase deploy --only functions
   ```

デプロイ後は `https://<region>-<project-id>.cloudfunctions.net/sendFinalShiftToSheet` 等が利用可能です。`FIREBASE_PROJECT_ID` が `.env.local` や Vercel にセットされていれば、Next.js 側の API から自動で Cloud Functions を呼び出します。

## Vercel へのデプロイ

1. Vercel プロジェクト設定で以下を登録
   - `FIREBASE_PROJECT_ID`（既に利用している場合はそのまま）
   - `FIREBASE_FUNCTIONS_REGION`（Functions を別リージョンにした場合）
   - `FIREBASE_FUNCTIONS_BASE_URL`（独自ドメインやリージョンが異なる場合のみ）
   - `DISCORD_WEBHOOK_URL` など *Cloud Functions が参照する値は Secret Manager に登録するため、Vercel 側では不要*
2. 必要に応じて `USE_FIREBASE_FUNCTIONS=true` を設定し、デプロイ後に確実に Functions を経由させます。
3. `npm run build` が通れば Vercel でそのままデプロイ可能です。

## 動作確認のポイント

- `npm run build` – Next.js 側のビルド確認
- Firebase Functions を更新したら `firebase emulators:start --only functions` でローカル確認
- Functions 呼び出しは `curl` で直接叩けます
  ```bash
  curl -X POST https://<region>-<project-id>.cloudfunctions.net/sendFinalShiftToSheet \
       -H "Content-Type: application/json" \
       -d '{"year":2025,"month":5}'
  ```

## トラブルシュート

- Functions が 403 を返す場合は CORS 設定 (`FUNCTIONS_ALLOWED_ORIGINS`) を見直してください。
- Vercel から Functions へ到達できない場合は `FIREBASE_PROJECT_ID` または `FIREBASE_FUNCTIONS_BASE_URL` が正しいか確認してください。
- Secret を変更したら再デプロイが必要です。`firebase deploy --only functions` を実行してください。

Happy hacking!
