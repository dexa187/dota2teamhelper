import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';

if (typeof HTMLInputElement !== 'undefined' && !('switch' in HTMLInputElement.prototype)) {
  void import('input-switch-polyfill');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
