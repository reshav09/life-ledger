import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { PrivacyProvider } from './PrivacyContext.jsx';
import { ThemeProvider } from './ThemeContext.jsx';
import { AppModeProvider } from './AppContext.jsx';
import { DialogProvider } from './components/DialogProvider.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppModeProvider>
          <PrivacyProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </PrivacyProvider>
        </AppModeProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
