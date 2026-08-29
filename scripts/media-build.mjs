import { readdir, stat, mkdir, copyFile, rm } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { parsePath } from './lib/taxonomy.mjs'
import { probe, ffmpeg } from './lib/ffmpeg.mjs'

const SRC = 'media'
const OUT = 'public/media'

// Au-delà de ce débit, ré-encoder fait gagner assez de poids pour justifier la
// perte de génération. En dessous, on se contente de remuxer : c'est instantané
// et sans perte. guitar-left/01→05 (2,3 Mbit/s) tombent dans ce cas.
const PASSTHROUGH_BITRATE = 2_800_000
const MAX_HEIGHT = 1080
const MAX_WIDTH = 1920

// Le CRF seul ne borne pas le poids : sur une image bruitée il dépense ce qu'il
// faut pour préserver le grain et peut rendre un fichier aussi lourd que la
// source. Le plafond de débit est ce qui garantit un résultat diffusable.
const MAX_BITRATE = '2200k'
const BUFSIZE = '4400k'

// Limite dure de GitHub. Dépassée, `git push` est rejeté.
const SIZE_WARN = 100 * 1024 * 1024

const force = process.argv.includes('--force')
const dry = process.argv.includes('--dry')

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

async function isStale(src, dest) {
  if (force) return true
  try {
    const [a, b] = await Promise.all([stat(src), stat(dest)])
    return a.mtimeMs > b.mtimeMs
  } catch {
    return true
  }
}

async function buildPoster(src, dest, duration) {
  const at = Math.max(1, Math.min(duration * 0.1, 10))
  await ffmpeg(['-ss', String(at), '-i', src, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', dest])
}

const files = await walk(SRC)
const skipped = []
// Renommer une source laisserait son ancien proxy en place, et le manifeste en
// ferait un item fantôme. On recense les sorties attendues pour supprimer le
// reste en fin de passe.
const expected = new Set()
let built = 0
let untouched = 0

for (const file of files.sort()) {
  const rel = relative(SRC, file)
  const meta = parsePath(rel)
  if (!meta) {
    skipped.push(rel)
    continue
  }

  const info = await probe(file)
  const destExt = info.hasVideo ? 'mp4' : meta.ext
  const dest = join(OUT, meta.dir, `${meta.base}.${destExt}`)
  const poster = info.hasVideo ? join(OUT, meta.dir, `${meta.base}.jpg`) : null
  expected.add(dest)
  if (poster) expected.add(poster)

  if (!(await isStale(file, dest))) {
    untouched++
    continue
  }

  const passthrough = info.hasVideo
    && info.videoCodec === 'h264'
    && info.height <= MAX_HEIGHT
    && info.bitrate <= PASSTHROUGH_BITRATE

  const action = !info.hasVideo ? 'copie' : passthrough ? 'remux' : 'ré-encodage'
  console.log(`${action.padEnd(12)} ${rel}`)
  if (dry) { built++; continue }

  await mkdir(dirname(dest), { recursive: true })

  if (!info.hasVideo) {
    // MP3 320 kbps : ré-encoder en lossy->lossy dégraderait pour ~20 Mo gagnés.
    await copyFile(file, dest)
  } else if (passthrough) {
    await ffmpeg(['-i', file, '-c', 'copy', '-movflags', '+faststart', dest])
  } else {
    await ffmpeg([
      '-i', file,
      '-vf', `scale=w='min(${MAX_WIDTH},iw)':h='min(${MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-maxrate', MAX_BITRATE, '-bufsize', BUFSIZE, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart',
      dest,
    ])
  }

  if (poster) await buildPoster(dest, poster, info.duration)
  built++
}

const orphans = (await walk(OUT).catch(() => [])).filter((f) => !expected.has(f))
for (const orphan of orphans) {
  console.log(`${'orphelin'.padEnd(12)} ${relative(OUT, orphan)}`)
  if (!dry) await rm(orphan)
}

const oversized = []
let total = 0
for (const file of await walk(OUT)) {
  const { size } = await stat(file)
  total += size
  if (size > SIZE_WARN) oversized.push([relative(OUT, file), size])
}

console.log(
  `\n${built} traité(s), ${untouched} déjà à jour, ${orphans.length} supprimé(s)`
  + ` — ${(total / 1e6).toFixed(0)} Mo au total.`,
)
if (oversized.length) {
  console.log(`\nAu-dessus des 100 Mo de la limite GitHub :`)
  for (const [f, size] of oversized) console.log(`  ${(size / 1e6).toFixed(0)} Mo  ${f}`)
}
if (skipped.length) {
  console.log(`\nIgnorés (hors taxonomie) :`)
  for (const s of skipped) console.log(`  ${s}`)
}
