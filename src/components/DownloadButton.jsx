import { primarySource, resolveUrl, downloadName, getTrack } from '../lib/media'
import { megabytes } from '../lib/format'

const ICON = 'M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'

// `download` ne s'applique qu'aux fichiers de même origine. Le jour où les
// médias partiront sur un bucket externe, le navigateur ouvrira le fichier au
// lieu de l'enregistrer : il faudra alors passer par un blob.
export function DownloadButton({ item, label = false }) {
  const track = getTrack(item.trackId)
  const source = primarySource(item)

  return (
    <a href={resolveUrl(source.path)} download={downloadName(item, track)}
      aria-label={`Télécharger ${track?.title} — ${item.label}`}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg text-dim transition-colors hover:bg-surface hover:text-bright ${
        label ? 'border border-line-strong px-3 py-1.5 text-sm' : 'p-2'
      }`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
        <path d={ICON} />
      </svg>
      {label && <span>Télécharger · {megabytes(source.bytes)}</span>}
    </a>
  )
}
