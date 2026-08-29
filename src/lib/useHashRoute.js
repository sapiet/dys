import { useSyncExternalStore } from 'react'

// Routage par hash : sur GitHub Pages un rafraîchissement sur /dys/track/01
// renverrait un 404, le serveur ne connaissant que index.html.

function subscribe(callback) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function snapshot() {
  return window.location.hash.slice(1) || '/'
}

export function useHashRoute() {
  const path = useSyncExternalStore(subscribe, snapshot, () => '/')
  const [, head, param] = path.split('/')

  if (head === 'track' && param) return { name: 'track', trackId: param }
  if (head === 'tracks') return { name: 'tracks' }
  return { name: 'media' }
}

export function href(path) {
  return `#${path}`
}
