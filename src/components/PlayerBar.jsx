import { usePlayer } from '../player/PlayerContext'
import { getTrack, isVideo } from '../lib/media'
import { duration as fmt } from '../lib/format'

export function PlayerBar() {
  const { current, playing, time, duration, volume, videoMounted, toggle, seek, setVolume } = usePlayer()
  if (!current) return null

  const track = getTrack(current.trackId)
  const total = duration || current.duration

  return (
    <div className="fixed inset-x-0 bottom-[57px] z-30 border-t border-line bg-panel md:bottom-0">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5 md:ml-56 md:max-w-none md:gap-4 md:px-8">
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}
          className="grid size-9 shrink-0 place-items-center rounded-full text-bright transition-colors hover:bg-surface">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
            {playing
              ? <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
              : <path d="M8 5.5v13l11-6.5z" />}
          </svg>
        </button>

        <div className="min-w-0 md:w-56">
          <p className="truncate text-sm">{track?.title}</p>
          <p className="truncate text-xs text-faint">
            {current.label}
            <span className="md:hidden"> · {fmt(time)}</span>
          </p>
        </div>

        <div className="hidden flex-1 items-center gap-3 md:flex">
          <span className="w-10 text-right text-xs tabular-nums text-faint">{fmt(time)}</span>
          <input type="range" min="0" max={total} step="0.1" value={Math.min(time, total)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position de lecture"
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent" />
          <span className="w-10 text-xs tabular-nums text-faint">{fmt(total)}</span>
        </div>

        <input type="range" min="0" max="1" step="0.01" value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-line-strong accent-accent lg:block" />

        {isVideo(current) && !videoMounted && (
          <a href={`#/track/${current.trackId}`}
            className="hidden shrink-0 text-xs text-faint hover:text-bright md:block">Revenir à la vidéo</a>
        )}
      </div>

      <div className="h-0.5 bg-line md:hidden">
        <div className="h-full bg-accent" style={{ width: `${total ? (time / total) * 100 : 0}%` }} />
      </div>
    </div>
  )
}
