import { basename, extname } from 'node:path'

// L'arborescence EST la taxonomie, et elle suit une forme unique :
//
//   <support>/<nature>[/<instrument>]/<morceau>.<ext>
//
//   audio/master/01.mp3                      -> master
//   audio/backing-tracks/drums/01.mp3        -> backing track, batterie
//   video/playthrough/bass/01.mp4            -> playthrough, basse
//
// Les natures connues sont déclarées ici, seul endroit à toucher pour en
// ajouter une. Tout chemin non reconnu est ignoré et signalé, jamais deviné.

const KINDS = {
  'audio/master': { kind: 'master', instrument: false },
  'audio/backing-tracks': { kind: 'backing-track', instrument: true },
  'video/playthrough': { kind: 'playthrough', instrument: true },
}

export function parsePath(rel) {
  const parts = rel.split('/')
  const file = parts.at(-1)
  if (file.startsWith('.')) return null

  const ext = extname(file).slice(1).toLowerCase()
  const base = basename(file, extname(file))
  if (!/^\d{2,}$/.test(base)) return null

  const nature = KINDS[`${parts[0]}/${parts[1]}`]
  if (!nature) return null

  // Le nombre de segments doit correspondre exactement : une nature à
  // instrument sans instrument, ou l'inverse, est une erreur de rangement
  // qu'il vaut mieux signaler que rattraper au jugé.
  const expected = nature.instrument ? 4 : 3
  if (parts.length !== expected) return null

  const instrument = nature.instrument ? parts[2] : null

  return {
    kind: nature.kind,
    trackId: base,
    instrument,
    id: instrument ? `${nature.kind}-${instrument}-${base}` : `${nature.kind}-${base}`,
    dir: parts.slice(0, -1).join('/'),
    base,
    ext,
  }
}

export const KIND_LABELS = {
  master: 'Master',
  'backing-track': 'Backing track',
  playthrough: 'Playthrough',
}

// Ordre d'affichage des angles d'un morceau : l'œuvre d'abord, puis ce qui
// s'en détache, puis ce qui sert à jouer dessus.
export const KIND_ORDER = ['master', 'playthrough', 'backing-track']

export const INSTRUMENT_LABELS = {
  bass: 'Bass',
  drums: 'Drums',
  'guitar-left': 'Guitar left',
  'guitar-right': 'Guitar right',
  keys: 'Keys',
  vocals: 'Vocals',
}

// Libellé court, affiché sur les pastilles d'angle et dans la barre de lecture.
// Le vocabulaire des médias reste en anglais, comme les dossiers ; seule
// l'interface elle-même est en français.
export function labelFor({ kind, instrument }) {
  if (!instrument) return KIND_LABELS[kind]
  const instrumentLabel = INSTRUMENT_LABELS[instrument] ?? instrument
  return kind === 'playthrough' ? instrumentLabel : `${instrumentLabel} backing track`
}
