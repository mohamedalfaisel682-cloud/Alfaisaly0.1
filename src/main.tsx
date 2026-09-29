import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initGlobalHindiDigitsConverter } from './lib/arabicDigitsConverter';

// Initialize universal Hindi / Eastern Arabic numerals converter for all inputs & forms
initGlobalHindiDigitsConverter();

try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    registerSW({ immediate: true });
  }
} catch (e) {
  console.warn('PWA ServiceWorker registration skipped on mobile/native WebView:', e);
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1058252271815-applet.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);