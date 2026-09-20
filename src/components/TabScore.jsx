import { useEffect, useRef, useState } from 'react'
import { documentFor, resolveUrl } from '../lib/media'
import { usePlayer } from '../player/PlayerContext'

// Gravure de la partition, et défilement du curseur sur le master.
//
// alphaTab pèse 278 Ko gzippés plus 306 Ko de police de notation. L'import est
// dynamique : rien n'est chargé tant qu'on n'affiche pas une tablature.

const COULEURS = {
  mainGlyphColor: '#e6ebf3',
  secondaryGlyphColor: '#98a3b6',
  staffLineColor: '#2b3547',
  barSeparatorColor: '#2b3547',
  barNumberColor: '#8ab4f0',
  scoreInfoColor: '#e6ebf3',
}

export function TabScore({ trackId, master, sync, offset = 0, hauteur = 'max-h-[70vh]' }) {
  const surfaceRef = useRef(null)
  const apiRef = useRef(null)
  const [etat, setEtat] = useState('chargement')
  const [erreur, setErreur] = useState(null)
  const [pistes, setPistes] = useState([])
  const [pisteActive, setPisteActive] = useState(0)

  const tablature = documentFor(trackId)
  const { current, playing, time, seek } = usePlayer()
  const enCours = sync && current?.id === master?.id

  const actions = useRef({})
  actions.current = { seek }

  useEffect(() => {
    if (!tablature) return
    let annule = false
    let api = null

    ;(async () => {
      const alphaTab = await import('@coderline/alphatab')
      if (annule) return

      api = new alphaTab.AlphaTabApi(surfaceRef.current, {
        core: {
          file: resolveUrl(tablature.sources[0].path),
          // Le plugin Vite fait chercher la police de notation à côté du script
          // d'alphaTab alors qu'il la copie à la racine du site ; le repli SPA
          // y renvoyait index.html, et le rendu ne démarrait jamais.
          fontDirectory: `${import.meta.env.BASE_URL}font/`,
          // Le worker d'alphaTab ne résout pas ses imports internes avec notre
          // `base` et casse le serveur de développement. La gravure prend
          // 43 ms sur le fil principal.
          useWorkers: false,
        },
        display: { resources: COULEURS },
        player: {
          // alphaTab ne produit aucun son : il suit notre lecteur.
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
      // d'événement « prêt » : on branche de façon idempotente depuis
      // plusieurs points d'accroche.
      const brancher = () => {
        if (!sync) return
        const sortie = api.player?.output
        if (!sortie || sortie.handler) return
        sortie.handler = {
          get backingTrackDuration() { return (master?.duration ?? 0) * 1000 },
          get playbackRate() { return 1 },
          set playbackRate(_) {},
          get masterVolume() { return 1 },
          set masterVolume(_) {},
          seekTo(ms) { actions.current.seek(ms / 1000) },
          // Sans effet : notre lecteur est déjà dans l'état voulu quand
          // alphaTab appelle ces méthodes, puisque c'est lui qui les provoque.
          play() {},
          pause() {},
        }
      }

      api.scoreLoaded.on((score) => {
        setPistes((score?.tracks ?? []).map((t) => ({
          index: t.index,
          nom: t.name?.trim() || `Piste ${t.index + 1}`,
        })))
        setPisteActive(0)
        brancher()
        if (!sync) return

        // Sans point de synchronisation, alphaTab n'a aucune correspondance
        // entre son axe temporel et celui du master, et refuse de démarrer.
        const premiere = score?.masterBars?.[0]
        if (!premiere || premiere.syncPoints?.length) return
        const point = new alphaTab.model.Automation()
        point.type = alphaTab.model.AutomationType.SyncPoint
        point.ratioPosition = 0
        point.syncPointValue = new alphaTab.model.SyncPointData()
        point.syncPointValue.barOccurence = 0
        point.syncPointValue.millisecondOffset = offset
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
  }, [tablature, master, sync, offset])

  // alphaTab suit l'état du lecteur. La comparaison évite la boucle : chacun
  // ne réagit que si l'autre a réellement changé.
  useEffect(() => {
    const api = apiRef.current
    if (!sync || !api?.player || etat !== 'pret') return
    const alphaTabJoue = api.player.state === 1
    if (enCours && playing && !alphaTabJoue) api.play()
    else if ((!playing || !enCours) && alphaTabJoue) api.pause()
  }, [sync, playing, enCours, etat])

  useEffect(() => {
    if (!sync || !enCours) return
    apiRef.current?.player?.output?.updatePosition?.(time * 1000)
  }, [sync, time, enCours])

  const choisirPiste = (index) => {
    const api = apiRef.current
    const piste = api?.score?.tracks?.[index]
    if (!piste) return
    setPisteActive(index)
    setEtat('chargement')
    api.renderTracks([piste])
  }

  if (!tablature) return null

  return (
    <>
      {pistes.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pistes.map((piste) => (
            <button key={piste.index} onClick={() => choisirPiste(piste.index)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
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

      <div className={`${hauteur} overflow-auto rounded-xl border border-line bg-surface p-3`}>
        <div ref={surfaceRef} />
      </div>
    </>
  )
}
