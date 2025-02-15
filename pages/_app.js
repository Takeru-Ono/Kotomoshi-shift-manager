import "../styles/globals.css"; // ここで Tailwind を適用！
import GlobalModal from "../components/GlobalModal";


function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <GlobalModal />
    </>
  );
}

export default MyApp;