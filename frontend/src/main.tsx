import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// This app registers no service worker, so any registration on this origin is a
// leftover from another app that once shared the port — it intercepts module
// requests and can serve stale chunks (mismatched React copies → blank screen).
// Unregister it, then reload once so this page is no longer under its control.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (!regs.length) return
    Promise.all(regs.map((r) => r.unregister())).then(() => {
      if (!sessionStorage.getItem('hs-sw-purged')) {
        sessionStorage.setItem('hs-sw-purged', '1')
        location.reload()
      }
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
