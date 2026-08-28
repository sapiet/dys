import { useState } from 'react'
import { groups, getTrack, resolveUrl, isVideo } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'
import { duration } from '../lib/format'

export function TypesView() {
  const all = groups()
  const [active, setActive] = useState(all[0]?.id ?? null)
  const { play, current, playing, setVideoEl } = usePlayer()
  const group = all.find((g) => g.id === active)

  // La file, c'est le groupe affiché : la lecture enchaîne les morceaux dans
  // l'ordre et reprend au premier une fois le dernier terminé.
  const start = (item) => play(item, { queue: group.items.map((i) => i.id) })

  const inGroup = group?.items.some((i) => i.id === current?.id)
  const onStage = inGroup && current && isVideo(current)

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-medium tracking-tight">Types</h1>
        <p className="mt-1 text-sm text-faint">Les mêmes médias, rangés par nature</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {all.map((g) => (
          <button key={g.id} onClick={() => setActive(g.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              g.id === active
                ? 'bg-accent text-white'
                : 'border border-line-strong text-dim hover:text-bright'
            }`}>
            {g.label}
          </button>
        ))}
      </div>

      {onStage && (
        <div className="mb-5">
          <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
            <video ref={setVideoEl} playsInline controls
              poster={current.poster ? resolveUrl(current.poster) : undefined}
              className="size-full" />
          </div>
          <p className="mt-2 text-xs text-faint">
            {getTrack(current.trackId)?.title} · {current.label} — enchaînement en boucle sur les {group.items.length} morceaux
          </p>
        </div>
      )}

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
        {group?.items.map((item) => {
          const isCurrent = current?.id === item.id
          return (
            <button key={item.id} onClick={() => start(item)}
              className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface ${
                isCurrent ? 'bg-surface' : ''
              }`}>
              <div className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-raised">
                {item.poster
                  ? <img src={resolveUrl(item.poster)} alt="" className={`size-full object-cover ${isCurrent ? 'opacity-50' : ''}`} />
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-faint" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>}
                {isCurrent && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="absolute size-5 text-accent-text" aria-hidden="true">
                    {playing ? <path d="M8 5h3v14H8zM13 5h3v14h-3z" /> : <path d="M8 5.5v13l11-6.5z" />}
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm ${isCurrent ? 'text-accent-text' : ''}`}>
                  {getTrack(item.trackId)?.title}
                </p>
                <p className="text-xs text-faint">
                  {duration(item.duration)}
                  {isVideo(item) && ` · ${item.sources[0].height}p`}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-faint">
        La lecture enchaîne les morceaux de la liste et reprend au premier après le dernier.
      </p>
    </>
  )
}
