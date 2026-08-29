import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribe, canInstall, promptInstall, isIOSSafari, isInstalled } from '../pwa/install'

const KEY = 'dys.install-dismissed'

// Le stockage lève en navigation privée sur certains navigateurs : un refus de
// mémoriser ne doit pas empêcher la page de s'afficher.
function readDismissed() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function InstallBanner() {
  const installable = useSyncExternalStore(subscribe, canInstall, () => false)
  const [dismissed, setDismissed] = useState(readDismissed)
  const [installed, setInstalled] = useState(isInstalled)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(isInstalled())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  if (installed || dismissed) return null
  if (!installable && !isIOSSafari) return null

  const close = () => {
    setDismissed(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // Mémorisation impossible : le bandeau reviendra au prochain chargement.
    }
  }

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
        className="size-5 shrink-0 text-accent-text" aria-hidden="true">
        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>

      <p className="min-w-0 flex-1 text-sm text-dim">
        {isIOSSafari && !installable ? (
          <>
            Ajoute le site à ton écran d’accueil : bouton <span className="text-bright">Partager</span>,
            puis <span className="text-bright">Sur l’écran d’accueil</span>.
          </>
        ) : (
          <>Installe le site comme une application, pour y accéder sans passer par le navigateur.</>
        )}
      </p>

      {installable && (
        <button onClick={promptInstall}
          className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-90">
          Installer
        </button>
      )}

      <button onClick={close} aria-label="Masquer"
        className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-bright">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" className="size-4" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
