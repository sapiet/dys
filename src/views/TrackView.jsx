import { useEffect, useRef } from 'react'
import { getTrack, anglesOf, resolveUrl, isVideo, absoluteUrl, documentFor } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'
import { duration as fmt, fileSize } from '../lib/format'
import { DownloadButton } from '../components/DownloadButton'
import { ShareButtons } from '../components/ShareButtons'
import { navigate } from '../lib/useHashRoute'

export function TrackView({ trackId, groupId }) {
  const track = getTrack(trackId)
  const { current, playing, time, play, switchTo, toggle, setVideoEl } = usePlayer()

  if (!track) {
    return (
      <p className="text-dim">
        Morceau introuvable. <a href="#/" className="text-accent-text underline">Retour aux morceaux</a>
      </p>
    )
  }

  const angles = anglesOf(trackId)
  // L'angle demandé par l'URL prime — c'est lui qui rend un lien partageable.
  // À défaut, on suit la lecture en cours si elle concerne ce morceau, sinon on
  // retombe sur le master.
  const angleId = (angle) => (angle.instrument ? `${angle.kind}-${angle.instrument}` : angle.kind)
  const selected = angles.find((a) => angleId(a) === groupId)
    ?? angles.find((a) => a.id === current?.id)
    ?? angles[0]
  const live = current?.id === selected.id
  const poster = selected.poster ?? angles.find((a) => a.poster)?.poster
  // La tablature n'est pas un angle : elle ne se joue pas, et l'ajouter aux
  // pastilles ferait croire le contraire.
  const tablature = documentFor(trackId)

  // Un lien qui précise l'angle désigne un média : on tente de le lancer, comme
  // dans la vue Médias. Sans angle, rien n'est désigné et on ne touche à rien.
  const arrivee = useRef(true)
  useEffect(() => {
    if (!arrivee.current) return
    arrivee.current = false
    if (groupId && selected.id !== current?.id) play(selected)
  })

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-medium tracking-tight">{track.title}</h1>
        <p className="mt-1 text-sm text-faint">
          {fmt(track.duration)} · {angles.length} angle{angles.length > 1 ? 's' : ''}
          {angles.length === 1 && ' disponible'}
        </p>
        {track.notes && <p className="mt-2 max-w-prose text-sm text-dim">{track.notes}</p>}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {angles.map((angle) => (
          <button key={angle.id}
            onClick={() => {
              navigate(`/track/${trackId}/${angleId(angle)}`, { replace: true })
              switchTo(angle)
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              angle.id === selected.id
                ? 'bg-accent text-white'
                : 'border border-line-strong text-dim hover:text-bright'
            }`}>
            {angle.label}
          </button>
        ))}
      </div>

      <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface">
        {live && isVideo(selected) ? (
          <video ref={setVideoEl} playsInline controls
            poster={poster ? resolveUrl(poster) : undefined}
            className="size-full bg-black" />
        ) : (
          <>
            {poster && <img src={resolveUrl(poster)} alt="" className="size-full object-cover opacity-40" />}
            <button onClick={() => (live ? toggle() : play(selected, { at: time }))}
              aria-label="Lecture"
              className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full bg-accent text-white transition-transform hover:scale-105">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden="true">
                  {live && playing ? <path d="M8 5h3v14H8zM13 5h3v14h-3z" /> : <path d="M8 5.5v13l11-6.5z" />}
                </svg>
              </span>
            </button>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {tablature && (
          <a href={`#/tab/${trackId}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-raised px-2.5 py-2 text-[13px] text-dim transition hover:bg-line-strong hover:text-bright sm:px-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10M18 15v6M15 18h6" />
            </svg>
            <span className="hidden sm:inline">Tablature</span>
          </a>
        )}
        {tablature && <DownloadButton item={tablature} />}
        <ShareButtons url={absoluteUrl(`/track/${trackId}/${angleId(selected)}`)}
          title={`${track.title} — ${selected.label}`} />
        <DownloadButton item={selected} label />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-5 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-faint">Angle</dt>
          <dd>{selected.label}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Durée</dt>
          <dd className="tabular-nums">{fmt(selected.duration)}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Définition</dt>
          <dd>{isVideo(selected) ? `${selected.sources[0].width}×${selected.sources[0].height}` : 'Audio'}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Poids</dt>
          <dd>{fileSize(selected.sources[0].bytes)}</dd>
        </div>
      </dl>
    </>
  )
}
