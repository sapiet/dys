import { useSyncExternalStore } from 'react'

// Routage par hash : sur GitHub Pages un rafraîchissement sur /dys/track/01
// renverrait un 404, le serveur ne connaissant que index.html.
//
// L'URL porte tout ce qui identifie un média, pour qu'un lien partagé ouvre
// exactement ce que voyait l'expéditeur :
//
//   #/media/playthrough-bass         un groupe
//   #/media/playthrough-bass/04      un média précis
//   #/track/04                       un morceau
//   #/track/04/playthrough-bass      un morceau vu sous un angle
//
// Les deux vues manipulent les mêmes identifiants — celui du groupe et celui
// du morceau — dans l'ordre qui correspond à leur entrée.

function subscribe(callback) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function snapshot() {
  return window.location.hash.slice(1) || '/'
}

export function useHashRoute() {
  const path = useSyncExternalStore(subscribe, snapshot, () => '/')
  const [, head, first, second] = path.split('/')

  if (head === 'track' && first) return { name: 'track', trackId: first, groupId: second ?? null }
  if (head === 'tracks') return { name: 'tracks' }
  return { name: 'media', groupId: head === 'media' ? (first ?? null) : null, trackId: head === 'media' ? (second ?? null) : null }
}

// `replace` pour un changement de sélection à l'intérieur d'une vue : sans lui,
// chaque clic sur un filtre empilerait une entrée d'historique, et revenir en
// arrière obligerait à défaire les filtres un par un.
export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`
  if (window.location.hash === target) return

  if (!replace) {
    window.location.hash = target
    return
  }

  window.history.replaceState(null, '', target)
  // replaceState n'émet pas `hashchange` : sans cet envoi, les composants
  // abonnés ne verraient pas le changement.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
