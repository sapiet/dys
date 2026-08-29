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

// Les angles d'un morceau. Le manifeste les livre déjà ordonnés — master,
// playthroughs, backing tracks — l'application ne fait que filtrer.
export function anglesOf(trackId) {
  return items.filter((i) => i.trackId === trackId)
}

export function primarySource(item) {
  const video = item.sources.find((s) => s.format === 'mp4')
  return video ?? item.sources[0]
}

export function isVideo(item) {
  return item.orientation !== null
}

// Les regroupements de la vue « Médias » viennent du manifeste : ajouter une
// nature de média ne demande aucune modification ici.
export function groups() {
  return manifest.groups.map((group) => ({
    ...group,
    items: group.itemIds.map((id) => byId.get(id)).filter(Boolean),
  }))
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Le nom du fichier téléchargé se construit sur la taxonomie, pas sur le
// libellé d'affichage : celui-ci est traduit, et donnait des hybrides comme
// « backing-batterie ». Les segments de l'arborescence sont déjà en anglais.
export function downloadName(item, track) {
  const source = primarySource(item)
  const parts = ['dys', item.trackId]
  if (track && track.title !== `#${item.trackId}`) parts.push(slug(track.title))
  if (item.instrument) parts.push(item.instrument)
  parts.push(item.kind)
  return `${parts.join('-')}.${source.format}`
}
