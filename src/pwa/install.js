// Chrome émet `beforeinstallprompt` peu après le chargement, souvent avant que
// React ait monté quoi que ce soit. On écoute donc dès l'évaluation du module,
// et on mémorise l'événement : il est le seul moyen d'ouvrir la boîte de
// dialogue d'installation, et il n'est pas rejoué.

let deferred = null
const listeners = new Set()

const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sans ce preventDefault, Chrome affiche sa propre infobar et consomme
    // l'événement : on ne pourrait plus proposer l'installation nous-mêmes.
    event.preventDefault()
    deferred = event
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function canInstall() {
  return deferred !== null
}

export async function promptInstall() {
  if (!deferred || typeof deferred.prompt !== 'function') return false
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  // L'événement n'est utilisable qu'une fois, quel que soit le choix.
  deferred = null
  notify()
  return outcome === 'accepted'
}

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent

// iPadOS 13+ se déclare comme un Mac : seul le nombre de points tactiles le
// distingue d'un ordinateur de bureau.
const isIOS = /iphone|ipad|ipod/i.test(ua)
  || (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)

// Les navigateurs tiers sur iOS n'installent pas de PWA : leur « sur l'écran
// d'accueil » crée un simple raccourci. Leur donner la consigne serait faux.
export const isIOSSafari = isIOS && !/crios|fxios|edgios|opios/i.test(ua)

export function isInstalled() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}
