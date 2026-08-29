import { InstallBanner } from './InstallBanner'
import { tracks } from '../lib/media'
import { duration } from '../lib/format'

const NAV = [
  { path: '/', name: 'media', label: 'Médias', icon: 'M4 6h16M4 12h16M4 18h16' },
  { path: '/tracks', name: 'tracks', label: 'Morceaux', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
]

function Icon({ path, className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export function Layout({ route, children }) {
  return (
    <div className="min-h-dvh pb-36 md:pb-24">
      {/* `bg-ink` explicite : l'aside est un contexte d'empilement (fixed + z-index),
          donc le `mix-blend-screen` du logo se mélange à ce fond-là, pas à celui
          du body. Sans lui, le noir du logo reste opaque. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-ink px-3 py-5 md:flex">
        <a href="#/" className="block px-1 pb-4">
          <img src={`${import.meta.env.BASE_URL}image/logo-wide.jpg`} alt="Drown Your Sorrows"
            className="w-full mix-blend-screen" />
        </a>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((entry) => (
            <a key={entry.path} href={`#${entry.path}`}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                route.name === entry.name || (entry.name === 'tracks' && route.name === 'track')
                  ? 'bg-accent-soft text-accent-text'
                  : 'text-dim hover:bg-surface hover:text-bright'
              }`}>
              <Icon path={entry.icon} />
              {entry.label}
            </a>
          ))}
        </nav>

        <p className="mt-7 px-2.5 pb-2 text-xs text-faint">Morceaux</p>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {tracks.map((track) => (
            <a key={track.id} href={`#/track/${track.id}`}
              className={`flex items-baseline justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                route.trackId === track.id ? 'bg-surface text-bright' : 'text-dim hover:text-bright'
              }`}>
              <span className="truncate">{track.title}</span>
              <span className="ml-2 shrink-0 text-xs text-faint">{duration(track.duration)}</span>
            </a>
          ))}
        </div>
      </aside>

      {/* Retraits horizontaux tenus identiques à ceux de la barre de lecture :
          un écart, même de 4 px, se voit sur la colonne de gauche. */}
      <main className="mx-auto max-w-4xl px-4 py-6 md:ml-56 md:px-6 md:py-9">
        <InstallBanner />
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-ink pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((entry) => (
          <a key={entry.path} href={`#${entry.path}`}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              route.name === entry.name || (entry.name === 'tracks' && route.name === 'track')
                ? 'text-accent-text'
                : 'text-faint'
            }`}>
            <Icon path={entry.icon} className="size-[22px]" />
            {entry.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
