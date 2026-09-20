import { useEffect, useRef, useState } from 'react'
import { getTrack, documentFor, resolveUrl, items } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'

// La tablature défile sur le master, sans passer par le synthétiseur
// d'alphaTab — le vrai enregistrement sonne mieux que du MIDI.
//
// alphaTab pèse 278 Ko gzippés plus 306 Ko de police de notation. L'import est
// dynamique : rien n'est chargé tant qu'on n'ouvre pas une tablature.

const COULEURS = {
  mainGlyphColor: '#e6ebf3',
  secondaryGlyphColor: '#98a3b6',
  staffLineColor: '#2b3547',
  barSeparatorColor: '#2b3547',
  barNumberColor: '#8ab4f0',
  scoreInfoColor: '#e6ebf3',
}

export function TabView({ trackId }) {
  const surfaceRef = useRef(null)
  const apiRef = useRef(null)
  const [etat, setEtat] = useState('chargement')
  const [erreur, setErreur] = useState(null)
  // Un fichier Guitar Pro porte toutes les pistes du morceau ; alphaTab n'en
  // grave qu'une à la fois.
  const [pistes, setPistes] = useState([])
  const [pisteActive, setPisteActive] = useState(0)

  const track = getTrack(trackId)
  const tablature = documentFor(trackId)
  const master = items.find((i) => i.trackId === trackId && i.kind === 'master')
  const { current, playing, time, select, seek, mediaElement } = usePlayer()

  // Sans master, ou tant que la tablature ne lui correspond pas, la partition
  // se consulte en silence : rien à synchroniser.
  const surMaster = Boolean(master) && track?.tabSync !== false
  const enCours = surMaster && current?.id === master?.id

  // alphaTab ne commande pas le transport : il suit. Les deux sens de pilotage
  // se marchaient dessus — il lançait notre lecteur, qui le relançait, et
  // l'élément audio finissait en pause pendant qu'alphaTab se croyait en
  // lecture. Seul le déplacement remonte, quand on clique une mesure.
  const actions = useRef({})
  actions.current = { seek }

  // Le master est désigné dès l'arrivée, sans être lancé : la barre du lecteur
  // est là d'emblée, et c'est elle qui commande. La page n'a donc pas besoin
  // de son propre bouton.
  useEffect(() => {
    if (surMaster && master && current?.id !== master.id) select(master)
  }, [surMaster, master, current?.id, select])

  useEffect(() => {
    if (!tablature || !master) return
    let annule = false
    let api = null

    ;(async () => {
      const alphaTab = await import('@coderline/alphatab')
      if (annule) return

      api = new alphaTab.AlphaTabApi(surfaceRef.current, {
        core: {
          file: resolveUrl(tablature.sources[0].path),
          // Le plugin Vite fait chercher la police de notation à côté du script
          // d'alphaTab, soit `assets/font/`, alors qu'il la copie à la racine
          // du site. Le repli SPA y renvoyait index.html : alphaTab recevait du
          // HTML pour une police, et le rendu ne démarrait jamais.
          fontDirectory: `${import.meta.env.BASE_URL}font/`,
          // Rendu sur le fil principal. Le worker d'alphaTab ne résout pas ses
          // imports internes avec notre `base` en développement, et pèse 2,2 Mo
          // en production. La gravure des 93 mesures de Massacre prend 43 ms :
          // le fil principal suffit largement.
          useWorkers: false,
        },
        display: { resources: COULEURS },
        player: {
          // alphaTab ne produit aucun son : il suit un média externe, le nôtre.
          playerMode: alphaTab.PlayerMode.EnabledExternalMedia,
          enableCursor: true,
          enableUserInteraction: true,
          scrollElement: surfaceRef.current.parentElement,
          scrollOffsetY: -60,
          nativeBrowserSmoothScroll: false,
        },
      })
      apiRef.current = api

      api.error.on((e) => { if (!annule) { setErreur(String(e?.message ?? e)); setEtat('erreur') } })
      api.renderFinished.on(() => { if (!annule) setEtat('pret') })

      // `api.player` naît de façon asynchrone et cette version n'expose pas
      // d'événement « prêt » : on pose le gestionnaire de façon idempotente
      // depuis plusieurs points d'accroche.
      const brancher = () => {
        if (!surMaster) return
        const sortie = api.player?.output
        if (!sortie || sortie.handler) return
        sortie.handler = {
          get backingTrackDuration() { return (master.duration ?? 0) * 1000 },
          get playbackRate() { return mediaElement?.playbackRate ?? 1 },
          set playbackRate(v) { if (mediaElement) mediaElement.playbackRate = v },
          get masterVolume() { return mediaElement?.volume ?? 1 },
          set masterVolume(v) { if (mediaElement) mediaElement.volume = v },
          // Le transport est délégué au lecteur global : c'est lui qui détient
          // l'élément audio, et la barre du bas doit rester cohérente.
          seekTo(ms) { actions.current.seek(ms / 1000) },
          // Sans effet : notre lecteur est déjà dans l'état voulu quand
          // alphaTab appelle ces méthodes, puisque c'est lui qui les provoque.
          play() {},
          pause() {},
        }
      }

      api.scoreLoaded.on((score) => {
        brancher()
        setPistes((score?.tracks ?? []).map((t) => ({ index: t.index, nom: t.name?.trim() || `Piste ${t.index + 1}` })))
        // Sans cette remise à zéro, passer d'un morceau à l'autre garderait la
        // piste précédente en surbrillance alors qu'une autre est gravée.
        setPisteActive(0)
        if (!surMaster) return

        // Sans point de synchronisation, alphaTab n'a aucune correspondance
        // entre son axe temporel et celui du master et refuse de démarrer.
        // Un point sur la première mesure pose l'origine ; la suite se déduit
        // du tempo, ce qui suffit tant que l'enregistrement le tient.
        const premiere = score?.masterBars?.[0]
        if (!premiere || premiere.syncPoints?.length) return
        const point = new alphaTab.model.Automation()
        point.type = alphaTab.model.AutomationType.SyncPoint
        point.ratioPosition = 0
        point.syncPointValue = new alphaTab.model.SyncPointData()
        point.syncPointValue.barOccurence = 0
        point.syncPointValue.millisecondOffset = track?.tabOffset ?? 0
        premiere.syncPoints = [point]
        api.updateSyncPoints()
      })
      api.midiLoaded.on(brancher)
      api.renderFinished.on(brancher)
    })().catch((e) => { if (!annule) { setErreur(String(e?.message ?? e)); setEtat('erreur') } })

    return () => {
      annule = true
      api?.destroy()
      apiRef.current = null
    }
  }, [tablature, master, track, surMaster])


  // alphaTab doit suivre l'état du lecteur global, y compris quand la lecture
  // est commandée depuis la barre du bas. La comparaison d'état évite la
  // boucle : chacun ne réagit que si l'autre a réellement changé.
  useEffect(() => {
    const api = apiRef.current
    if (!surMaster || !api?.player || etat !== 'pret') return
    const alphaTabJoue = api.player.state === 1
    if (enCours && playing && !alphaTabJoue) api.play()
    else if ((!playing || !enCours) && alphaTabJoue) api.pause()
  }, [surMaster, playing, enCours, etat])

  // La position du master pilote le curseur.
  useEffect(() => {
    if (!surMaster || !enCours) return
    apiRef.current?.player?.output?.updatePosition?.(time * 1000)
  }, [surMaster, time, enCours])

  const choisirPiste = (index) => {
    const api = apiRef.current
    const piste = api?.score?.tracks?.[index]
    if (!piste) return
    setPisteActive(index)
    setEtat('chargement')
    api.renderTracks([piste])
  }

  if (!track) return <p className="text-dim">Morceau introuvable.</p>
  if (!tablature) {
    return (
      <p className="text-dim">
        Pas de tablature pour « {track.title} ».{' '}
        <a href={`#/track/${trackId}`} className="text-accent-text underline">Revenir au morceau</a>
      </p>
    )
  }

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{track.title}</h1>
          <p className="mt-1 text-sm text-faint">
            {surMaster
              ? 'Tablature · défile sur le master'
              : master
                ? 'Tablature · consultation seule, elle ne correspond pas encore à l’enregistrement'
                : 'Tablature · consultation seule, pas d’enregistrement pour ce morceau'}
          </p>
        </div>
        <a href={`#/track/${trackId}`}
          className="shrink-0 rounded-full bg-raised px-4 py-2 text-[13px] text-dim transition hover:bg-line-strong hover:text-bright">
          Retour au morceau
        </a>
      </header>

      {pistes.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pistes.map((piste) => (
            <button key={piste.index} onClick={() => choisirPiste(piste.index)}
              className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                piste.index === pisteActive
                  ? 'bg-accent text-white'
                  : 'border border-line-strong text-dim hover:text-bright'
              }`}>
              {piste.nom}
            </button>
          ))}
        </div>
      )}

      {etat === 'chargement' && <p className="mb-2 text-sm text-faint">Gravure de la partition…</p>}
      {etat === 'erreur' && (
        <p className="mb-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-dim">
          La partition n’a pas pu être affichée : {erreur}
        </p>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface p-3">
        <div ref={surfaceRef} />
      </div>
    </>
  )
}
