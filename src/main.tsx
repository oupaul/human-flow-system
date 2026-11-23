import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n/config'
import { applyBranding } from './lib/branding'

applyBranding();

createRoot(document.getElementById("root")!).render(<App />);
