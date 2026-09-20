import { useEffect, useRef } from 'react'
import { groups, getTrack, resolveUrl, isVideo, absoluteUrl } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'
import { navigate } from '../lib/useHashRoute'
import { duration, totalDuration, fileSize } from '../lib/format'
import { DownloadButton } from '../components/DownloadButton'
import { ShareButtons } from '../components/ShareButtons'

// Le fond du logo est écrasé en noir pur à la génération : `screen` le fait
// alors disparaître sans masque, et le halo bleu — qu'un détourage aurait
// mangé — est préservé.
export function MediaView({ route }) {
  const all = groups()
  const { play, select, toggle, current, playing, setVideoEl } = usePlayer()

  // La sélection vit dans l'URL, pas dans l'état : c'est ce qui rend un lien
  // partageable. Le groupe demandé peut être une nature ou un de ses enfants.
  const nature = all.find((g) => g.id === route.groupId || g.children.some((c) => c.id === route.groupId)) ?? all[0]
  // Choisir une nature retombe sur son premier instrument : sans ça,
  // « Playthrough » n'afficherait rien tant qu'on n'aurait pas cliqué deux fois.
  const child = nature?.children.find((c) => c.id === route.groupId) ?? nature?.children[0]
  const group = child ?? nature

  const goTo = (groupId, trackId) =>
    navigate(`/media/${groupId}${trackId ? `/${trackId}` : ''}`, { replace: true })

  // URL et lecteur se désignent mutuellement. Deux effets séparés se
  // combattaient : celui qui restaure depuis l'URL annulait celui qui suit
  // l'enchaînement. Un seul effet, qui regarde laquelle des deux sources vient
  // de changer, lève l'ambiguïté.
  const dernierRoute = useRef(null)
  const dernierMedia = useRef(null)
  // Seule l'arrivée sur un lien tente la lecture. Les navigations internes
  // passent déjà par un clic, qui décide lui-même de lancer ou non.
  const arrivee = useRef(true)

  useEffect(() => {
    // Un groupe de documents n'a rien à donner au lecteur : une tablature ne
    // se joue pas. Sans cette garde, ouvrir #/media/tab/04 appelait play() sur
    // un fichier Guitar Pro et faisait apparaître la barre de lecture.
    if (!group || group.documents) return
    const routeAChange = route.trackId !== dernierRoute.current
    const mediaAChange = current?.id !== dernierMedia.current
    const estArrivee = arrivee.current
    arrivee.current = false
    dernierRoute.current = route.trackId
    dernierMedia.current = current?.id

    // L'URL a changé : elle désigne le média à mettre en place. On ne le lance
    // pas — les navigateurs refusent la lecture automatique, et démarrer le son
    // chez quelqu'un qui vient d'ouvrir un lien serait de toute façon brutal.
    if (routeAChange && route.trackId) {
      const item = group.items.find((i) => i.trackId === route.trackId)
      if (item) {
        const file = { queue: group.items.map((i) => i.id) }
        // Les navigateurs refusent la lecture sans interaction préalable. La
        // tentative aboutit dans l'app installée ou chez un visiteur habitué ;
        // ailleurs, PlayerContext capte le rejet et propose un bouton.
        //
        // On tente même si le média est déjà celui en cours : recevoir un lien
        // vers ce qu'on écoutait en pause doit le relancer.
        if (estArrivee) play(item, file)
        else if (item.id !== current?.id) select(item, file)
        return
      }
    }

    // La lecture a avancé d'elle-même : l'URL suit, pour rester copiable à tout
    // instant sans désigner un média qu'on n'écoute plus.
    if (mediaAChange && current
      && group.items.some((i) => i.id === current.id)
      && route.trackId !== current.trackId) {
      goTo(group.id, current.trackId)
    }
  })

  const start = (item) => {
    goTo(group.id, item.trackId)
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
            <button key={g.id} onClick={() => goTo(g.children[0]?.id ?? g.id)}
              className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                g.id === nature?.id
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
              <button key={c.id} onClick={() => goTo(c.id)}
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-faint">
              {getTrack(current.trackId)?.title} · {current.label}
            </p>
            <ShareButtons url={absoluteUrl(`/media/${group.id}/${current.trackId}`)}
              title={`${getTrack(current.trackId)?.title} — ${current.label}`} />
            <DownloadButton item={current} label />
          </div>
        </div>
      )}

      <p className="mb-2 text-xs text-faint">
        {group?.items.length} {group?.documents ? 'tablature' : 'média'}{group?.items.length > 1 ? 's' : ''}
        {/* Un document n'a pas de durée : le cumul n'aurait rien à additionner. */}
        {!group?.documents && ` · ${totalDuration((group?.items ?? []).reduce((sum, i) => sum + i.duration, 0))}`}
      </p>

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
        {group?.items.map((item) => {
          // Pour un document, c'est l'URL qui désigne la ligne : aucun lecteur
          // ne peut s'en charger.
          const isCurrent = item.document
            ? route.trackId === item.trackId
            : current?.id === item.id
          return (
            <div key={item.id}
              className={`flex items-center gap-3 pr-2 transition-colors hover:bg-surface ${
                isCurrent ? 'bg-surface' : ''
              }`}>
              {item.document ? (
                <a href={`#/track/${item.trackId}/tab`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                  <div className="grid aspect-video w-20 shrink-0 place-items-center rounded-md bg-raised sm:w-24">
                    <span className="text-[11px] uppercase text-faint">{item.sources[0].format}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{getTrack(item.trackId)?.title}</p>
                    <p className="text-xs text-faint">Guitar Pro · {fileSize(item.sources[0].bytes)}</p>
                  </div>
                </a>
              ) : (
              <button onClick={() => start(item)}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
              <div className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-raised sm:w-24">
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
              )}
              <ShareButtons compact
                url={absoluteUrl(`/media/${group.id}/${item.trackId}`)}
                title={getTrack(item.trackId)?.title ?? item.trackId} />
              <DownloadButton item={item} />
            </div>
          )
        })}
      </div>
    </>
  )
}
