import React from 'react'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { DialogProvider } from './components/DialogProvider';
import { SessionProvider } from './components/SessionProvider';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider><SessionProvider><App /></SessionProvider></DialogProvider>
  </React.StrictMode>,
)
