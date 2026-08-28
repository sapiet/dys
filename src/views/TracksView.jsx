import { tracks, anglesOf, resolveUrl } from '../lib/media'
import { duration } from '../lib/format'

export function TracksView() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-medium tracking-tight">Morceaux</h1>
        <p className="mt-1 text-sm text-faint">{tracks.length} compositions</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((track) => {
          const angles = anglesOf(track.id)
          const illustrated = angles.find((a) => a.poster)

          return (
            <a key={track.id} href={`#/track/${track.id}`}
              className="group overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong">
              <div className="aspect-video bg-raised">
                {illustrated && (
                  <img src={resolveUrl(illustrated.poster)} alt=""
                    className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
                )}
              </div>
              <div className="px-3.5 py-3">
                <p className="font-medium">{track.title}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {duration(track.duration)} · {angles.length} angle{angles.length > 1 ? 's' : ''}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </>
  )
}
