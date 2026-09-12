import { useEffect, useRef } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { getTrack, resolveUrl } from '../lib/media'
import { duration as fmt } from '../lib/format'

// N'apparaît que si le navigateur a refusé la lecture automatique. Dans
// l'application installée, où elle aboutit, cette boîte ne se montre jamais.
export function UnlockDialog() {
  const { blocked, current, toggle, dismissBlocked } = usePlayer()
  const boutonRef = useRef(null)

  useEffect(() => {
    if (!blocked) return
    boutonRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') dismissBlocked() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocked, dismissBlocked])

  if (!blocked || !current) return null

  const track = getTrack(current.trackId)

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="unlock-titre"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5"
      onClick={dismissBlocked}>
      <div onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-line-strong bg-panel">
        {current.poster && (
          <img src={resolveUrl(current.poster)} alt=""
            className="aspect-video w-full object-cover opacity-70" />
        )}

        <div className="px-5 py-5 text-center">
          <p className="text-xs text-faint">{current.label} · {fmt(current.duration)}</p>
          <h2 id="unlock-titre" className="mt-1 text-xl font-medium tracking-tight">
            {track?.title}
          </h2>

          <button ref={boutonRef} onClick={toggle}
            className="mx-auto mt-5 flex items-center gap-2.5 rounded-full bg-accent px-5 py-2.5 text-sm text-white transition-transform hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            Lancer la lecture
          </button>

          <button onClick={dismissBlocked}
            className="mt-3 text-xs text-faint transition-colors hover:text-bright">
            Parcourir sans écouter
          </button>
        </div>
      </div>
    </div>
  )
}
