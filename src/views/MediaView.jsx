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
  const [natureId, setNatureId] = useState(all[0]?.id ?? null)
  // Choisir une nature sélectionne son premier instrument : sans ça, « Playthroughs »
  // n'afficherait rien tant qu'on n'aurait pas cliqué une seconde fois.
  const [childId, setChildId] = useState(all[0]?.children?.[0]?.id ?? null)
  const { play, toggle, current, playing, setVideoEl } = usePlayer()

  const nature = all.find((g) => g.id === natureId)
  const child = nature?.children.find((c) => c.id === childId) ?? nature?.children[0]
  const group = child ?? nature

  const selectNature = (next) => {
    setNatureId(next.id)
    setChildId(next.children[0]?.id ?? null)
  }

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
      <header className="mb-6 text-center md:mb-5 md:text-left">
        {/* Sur desktop le logo est déjà au-dessus du menu : le répéter ici
            ferait doublon, le titre texte prend le relais. */}
        <img src={`${import.meta.env.BASE_URL}image/logo-wide.jpg`} alt="Drown Your Sorrows"
          className="mx-auto w-full max-w-52 mix-blend-screen sm:max-w-sm md:hidden" />
        <h1 className="sr-only md:not-sr-only md:text-2xl md:font-medium md:tracking-tight">Médias</h1>
      </header>

      <div className="mb-5">
        <div className="flex flex-wrap gap-2">
          {all.map((g) => (
            <button key={g.id} onClick={() => selectNature(g)}
              className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                g.id === natureId
                  ? 'bg-accent text-white'
                  : 'border border-line-strong text-dim hover:text-bright'
              }`}>
              {g.label}
            </button>
          ))}
        </div>

        {/* Second étage masqué quand il n'y a rien à départager : une nature à
            instrument unique n'a pas besoin qu'on la précise. */}
        {nature && nature.children.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3">
            {nature.children.map((c) => (
              <button key={c.id} onClick={() => setChildId(c.id)}
                className={`border-b-2 pb-1 text-[13px] transition-colors ${
                  c.id === group?.id
                    ? 'border-accent text-accent-text'
                    : 'border-transparent text-faint hover:text-bright'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        )}
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
              {getTrack(current.trackId)?.title} · {current.label}
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
