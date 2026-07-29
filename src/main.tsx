import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/cinzel';
import '@fontsource-variable/nunito-sans';
import './styles/index.css';
import App from './App';
import { captureInstallOffer } from './ui/installOffer';

// Before the first render: Chrome fires `beforeinstallprompt` within a few
// hundred ms on a returning visit, which would otherwise race the async save
// bootstrap that gates the whole tree (src/ui/installOffer.ts).
captureInstallOffer();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
