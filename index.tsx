// Silence noisy extension console warnings
// eslint-disable-next-line @typescript-eslint/no-empty-function
// @ts-ignore
window.console.warn = () => {};
// @ts-ignore
window.console.error = (msg: unknown) => {
  try {
    const s = String(msg || '');
    if (s.includes('extension')) return;
  } catch {}
  // eslint-disable-next-line no-console
  console.log(String(msg));
};

// Kaseddie Bridge (replaces DigitalOcean Chatbot Bridge)
(() => {
  (window as any).ChatbotBridge = {
    setLeads: (leads: any[]) => {
      (window as any).ChatbotContext = { vettedLeads: leads };
    },
    open: () => {
      // For now, we'll just log - the chat is always visible in the sidebar
      console.log('🤖 Kaseddie Uplink: Chat interface active');
    }
  };
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
