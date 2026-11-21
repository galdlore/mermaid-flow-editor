import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { I18nProvider, detectInitialLanguage, loadLocaleCatalog } from './i18n';

async function bootstrap(): Promise<void> {
  const initialLang = detectInitialLanguage();
  const initialCatalog = await loadLocaleCatalog(initialLang);
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    return;
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <I18nProvider initialLang={initialLang} initialCatalog={initialCatalog}>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
}

void bootstrap();
