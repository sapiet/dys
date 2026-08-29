import { useState } from 'react'
import { groups, getTrack, resolveUrl, isVideo } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'
import { duration } from '../lib/format'
import { DownloadButton } from '../components/DownloadButton'

// Le fond du logo est écrasé en noir pur à la génération : `screen` le fait
// alors disparaître sans masque, et le halo bleu — qu'un détourage aurait
// mangé — est préservé.
export function MediaView() {
  const all = groups()
  const [active, setActive] = useState(all[0]?.id ?? null)
  const { play, toggle, current, playing, setVideoEl } = usePlayer()
  const group = all.find((g) => g.id === active)

  // La file, c'est le groupe affiché : la lecture enchaîne les morceaux dans
  // l'ordre et reprend au premier une fois le dernier terminé. Recliquer la
  // ligne déjà active met en pause plutôt que de relancer depuis le début.
  const start = (item) => {
    if (current?.id === item.id) toggle()
    else play(item, { queue: group.items.map((i) => i.id) })
  }

  const inGroup = group?.items.some((i) => i.id === current?.id)
  const onStage = inGroup && current && isVideo(current)

  return (
    <>
      <header className="mb-6 text-center">
        <h1 className="sr-only">Drown Your Sorrows</h1>
        <img src={`${import.meta.env.BASE_URL}image/logo-wide.jpg`} alt=""
          className="mx-auto w-full max-w-52 mix-blend-screen sm:max-w-sm" />
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
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-faint">
              {getTrack(current.trackId)?.title} · {current.label} — enchaînement en boucle sur les {group.items.length} morceaux
            </p>
            <DownloadButton item={current} label />
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
        {group?.items.map((item) => {
          const isCurrent = current?.id === item.id
          return (
            <div key={item.id}
              className={`flex items-center gap-3 pr-2 transition-colors hover:bg-surface ${
                isCurrent ? 'bg-surface' : ''
              }`}>
              <button onClick={() => start(item)}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
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
              <DownloadButton item={item} />
            </div>
          )
        })}
      </div>
    </>
  )
}
