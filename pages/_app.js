import "../styles/globals.css"; // ここで Tailwind を適用！

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;