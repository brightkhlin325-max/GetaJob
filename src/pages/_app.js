import '../styles/designTokens.css';
import '../styles/globals.css'; // optional existing globals
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Component {...pageProps} />
      </LanguageProvider>
    </ThemeProvider>
  );
}
