import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ja">
      <Head />
      <body>
        <Main />
        <NextScript />
        <div id="modal-root"></div> {/* 🔥 ここにモーダルを描画する */}
      </body>
    </Html>
  );
}