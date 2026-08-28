import { getTrack, anglesOf, resolveUrl, isVideo } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'
import { duration as fmt, megabytes } from '../lib/format'

export function TrackView({ trackId }) {
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
  // L'angle affiché suit la lecture en cours dès qu'elle concerne ce morceau ;
  // sinon on retombe sur le master.
  const selected = angles.find((a) => a.id === current?.id) ?? angles[0]
  const live = current?.id === selected.id
  const poster = selected.poster ?? angles.find((a) => a.poster)?.poster

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
          <button key={angle.id} onClick={() => switchTo(angle)}
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

      <p className="mt-3 text-xs text-faint">
        {angles.length > 1
          ? 'Changer d’angle conserve la position de lecture.'
          : 'Un seul angle enregistré pour ce morceau.'}
      </p>

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
          <dd>{megabytes(selected.sources[0].bytes)}</dd>
        </div>
      </dl>
    </>
  )
}
