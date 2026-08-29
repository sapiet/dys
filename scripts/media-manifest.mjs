import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative, dirname, extname, basename } from 'node:path'
import { parsePath, labelFor, KIND_LABELS, KIND_ORDER } from './lib/taxonomy.mjs'
import { probe } from './lib/ffmpeg.mjs'

const OUT = 'public/media'
const META = 'media.meta.json'
const MANIFEST = 'src/media.json'

// Deux rendus du même item ne sont groupés que si leurs durées concordent.
// Au-delà, c'est qu'ils n'ont pas le même contenu (un rush et son montage
// portent volontiers le même nom) : on refuse de fusionner et on le signale.
const DURATION_TOLERANCE = 0.05

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(path)))
    else out.push(path)
  }
  return out
}

async function readMeta() {
  try {
    return JSON.parse(await readFile(META, 'utf8'))
  } catch {
    return { tracks: {}, sessions: {} }
  }
}

const meta = await readMeta()
const files = (await walk(OUT)).sort()
const warnings = []
const items = new Map()

for (const file of files) {
  const rel = relative(OUT, file)
  if (extname(rel) === '.jpg') continue

  const parsed = parsePath(rel)
  if (!parsed) {
    warnings.push(`hors taxonomie, ignoré : ${rel}`)
    continue
  }

  const info = await probe(file)
  const source = {
    format: parsed.ext,
    path: rel,
    bytes: info.bytes,
    width: info.width,
    height: info.height,
  }

  const existing = items.get(parsed.id)
  if (!existing) {
    const posterRel = join(dirname(rel), `${basename(rel, extname(rel))}.jpg`)
    items.set(parsed.id, {
      id: parsed.id,
      kind: parsed.kind,
      trackId: parsed.trackId,
      instrument: parsed.instrument,
      label: labelFor(parsed),
      instrumentLabel: parsed.instrument ? labelFor({ kind: 'playthrough', instrument: parsed.instrument }) : null,
      duration: Math.round(info.duration),
      orientation: !info.hasVideo ? null : info.width >= info.height ? 'landscape' : 'portrait',
      poster: files.includes(join(OUT, posterRel)) ? posterRel : null,
      sources: [source],
    })
    continue
  }

  const drift = Math.abs(existing.duration - info.duration) / Math.max(existing.duration, 1)
  if (drift > DURATION_TOLERANCE) {
    warnings.push(
      `durées incompatibles pour « ${parsed.id} » : ${existing.duration}s vs ${Math.round(info.duration)}s — ${rel} non groupé`,
    )
    continue
  }
  existing.sources.push(source)
}

// Ordre unique, décidé ici : l'application se contente ensuite de filtrer sans
// jamais réordonner, donc pastilles d'angle et listes restent cohérentes.
const list = [...items.values()].sort((a, b) =>
  a.trackId.localeCompare(b.trackId)
  || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  || (a.instrument ?? '').localeCompare(b.instrument ?? ''),
)
const trackIds = [...new Set(list.map((i) => i.trackId))].sort()

// Les regroupements de la vue « Médias » sont imbriqués : la nature d'abord,
// l'instrument ensuite. À plat, leur nombre serait multiplicatif — une pastille
// par couple nature × instrument, et « Playthrough » répété autant de fois.
const groups = []
for (const item of list) {
  let nature = groups.find((g) => g.id === item.kind)
  if (!nature) {
    nature = { id: item.kind, label: `${KIND_LABELS[item.kind]}s`, itemIds: [], children: [] }
    groups.push(nature)
  }

  if (!item.instrument) {
    nature.itemIds.push(item.id)
    continue
  }

  const childId = `${item.kind}-${item.instrument}`
  let child = nature.children.find((c) => c.id === childId)
  if (!child) {
    child = { id: childId, label: item.instrumentLabel, itemIds: [] }
    nature.children.push(child)
  }
  child.itemIds.push(item.id)
}

const tracks = trackIds.map((id) => {
  const own = list.filter((i) => i.trackId === id)
  const master = own.find((i) => i.kind === 'master')
  return {
    id,
    number: Number(id),
    title: meta.tracks?.[id]?.title ?? `#${id}`,
    notes: meta.tracks?.[id]?.notes ?? null,
    duration: master?.duration ?? Math.max(...own.map((i) => i.duration)),
    itemIds: own.map((i) => i.id),
  }
})

for (const id of Object.keys(meta.tracks ?? {})) {
  if (!trackIds.includes(id)) warnings.push(`media.meta.json décrit le morceau « ${id} », aucun média correspondant`)
}

await mkdir(dirname(MANIFEST), { recursive: true })
await writeFile(
  MANIFEST,
  `${JSON.stringify({ baseUrl: 'media/', tracks, groups, items: list }, null, 2)}\n`,
)

console.log(`${tracks.length} morceau(x), ${list.length} item(s), ${groups.length} groupe(s) -> ${MANIFEST}`)
if (warnings.length) {
  console.log('\nAvertissements :')
  for (const w of warnings) console.log(`  ${w}`)
}
