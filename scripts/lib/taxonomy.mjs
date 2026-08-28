import { basename, extname } from 'node:path'

// L'arborescence EST la taxonomie. Une seule fonction en décide, partagée par
// le build et le manifeste, pour qu'ils ne puissent pas diverger.
//
//   audio/<morceau>.mp3                  -> master
//   playthrough/<instrument>/<morceau>.* -> playthrough
//
// Tout chemin non reconnu est ignoré et signalé, jamais deviné.

export function parsePath(rel) {
  const parts = rel.split('/')
  const file = parts.at(-1)
  if (file.startsWith('.')) return null

  const ext = extname(file).slice(1).toLowerCase()
  const base = basename(file, extname(file))
  if (!/^\d{2,}$/.test(base)) return null

  if (parts[0] === 'audio' && parts.length === 2) {
    return { kind: 'master', trackId: base, instrument: null, id: `master-${base}`, dir: 'audio', base, ext }
  }

  if (parts[0] === 'playthrough' && parts.length === 3) {
    const instrument = parts[1]
    return {
      kind: 'playthrough',
      trackId: base,
      instrument,
      id: `playthrough-${instrument}-${base}`,
      dir: `playthrough/${instrument}`,
      base,
      ext,
    }
  }

  return null
}

export const KIND_LABELS = { master: 'Master', playthrough: 'Playthrough' }

export const INSTRUMENT_LABELS = {
  bass: 'Basse',
  'guitar-left': 'Guitare gauche',
  'guitar-right': 'Guitare droite',
  drums: 'Batterie',
  vocals: 'Voix',
}
