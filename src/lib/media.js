import manifest from '../media.json'

// Le manifeste stocke des chemins relatifs. Si `baseUrl` devient un jour une URL
// absolue (bucket externe), rien d'autre ne change dans l'application.
export function resolveUrl(path) {
  if (!path) return null
  const base = manifest.baseUrl
  if (/^https?:\/\//.test(base)) return base + path
  return import.meta.env.BASE_URL + base + path
}

export const tracks = manifest.tracks
export const items = manifest.items

const byId = new Map(items.map((item) => [item.id, item]))

export function getItem(id) {
  return byId.get(id) ?? null
}

export function getTrack(id) {
  return tracks.find((t) => t.id === id) ?? null
}

// Les angles d'un morceau, master d'abord : c'est l'entrée par défaut.
export function anglesOf(trackId) {
  const own = items.filter((i) => i.trackId === trackId)
  return [
    ...own.filter((i) => i.kind === 'master'),
    ...own.filter((i) => i.kind !== 'master'),
  ]
}

export function primarySource(item) {
  const video = item.sources.find((s) => s.format === 'mp4')
  return video ?? item.sources[0]
}

export function isVideo(item) {
  return item.orientation !== null
}

// Les regroupements de la vue « Médias ». Un item n'existe qu'une fois dans le
// manifeste ; ce sont des index, pas des copies.
export function groups() {
  const out = []
  const masters = items.filter((i) => i.kind === 'master')
  if (masters.length) out.push({ id: 'master', label: 'Masters', items: masters })

  const instruments = [...new Set(items.filter((i) => i.instrument).map((i) => i.instrument))]
  for (const instrument of instruments.sort()) {
    const own = items.filter((i) => i.instrument === instrument)
    out.push({ id: `playthrough-${instrument}`, label: `Playthrough — ${own[0].label}`, items: own })
  }
  return out
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Un fichier téléchargé s'appelle `01.mp4` sur le disque : sans nom explicite,
// six morceaux donnent six fichiers indiscernables.
export function downloadName(item, track) {
  const source = primarySource(item)
  const parts = ['dys', item.trackId]
  if (track && track.title !== `#${item.trackId}`) parts.push(slug(track.title))
  parts.push(slug(item.label))
  return `${parts.join('-')}.${source.format}`
}
