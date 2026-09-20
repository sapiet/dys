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

// La banque de sons du synthétiseur, déposée dans `public/` par le plugin Vite
// au même titre que la police. 954 Ko : elle n'est téléchargée qu'au moment où
// l'on réclame le son d'alphaTab, jamais à la simple consultation.
const BANQUE_DE_SONS = `${import.meta.env.BASE_URL}soundfont/sonivox.sf3`

export function TabScore({ trackId, master, sync, offset = 0, hauteur = 'max-h-[70vh]', onPistes }) {
  const surfaceRef = useRef(null)
  const apiRef = useRef(null)
  const alphaTabRef = useRef(null)
  const [etat, setEtat] = useState('chargement')
  const [erreur, setErreur] = useState(null)
  const [pistes, setPistes] = useState([])
  const [pisteActive, setPisteActive] = useState(0)
  const [apiPrete, setApiPrete] = useState(false)

  // Deux sons pour une même partition : l'enregistrement, qu'alphaTab se
  // contente de suivre, ou son propre synthétiseur, qui joue ce qui est écrit.
  // Sans master à suivre, il ne reste que le second.
  const [son, setSon] = useState(sync ? 'master' : 'synthe')
  // Le synthétiseur ne naît qu'au premier appui sur lecture : il coûte un
  // worker et le téléchargement de la banque de sons.
  const [arme, setArme] = useState(false)
  const [sonPret, setSonPret] = useState(false)
  const sonPretRef = useRef(false)
  const volumeRef = useRef(1)
  // Position musicale, sur l'axe d'alphaTab : c'est elle qui passe d'un son à
  // l'autre. Le point de synchronisation dit que les deux axes se répondent au
  // décalage près, et c'est tout ce qu'il faut pour les convertir.
  const positionRef = useRef(0)
  const reprise = useRef(0)
  // Seul un clic sur la partition doit déplacer l'enregistrement. alphaTab
  // remet son lecteur au début chaque fois qu'il régénère son midi — au
  // chargement, au changement de piste, à la bascule de son — et l'annonce par
  // le même chemin qu'un clic : sans cette fenêtre, ouvrir une tablature
  // pendant la lecture la ramenait à zéro.
  const clic = useRef(false)

  const tablature = documentFor(trackId)
  const { current, playing, time, seek, switchTo, attachEngine, detachEngine, reportEngine } = usePlayer()

  const surSynthe = son === 'synthe'
  // Armé et choisi : alphaTab produit le son et commande la lecture.
  const syntheActif = surSynthe && arme
  // alphaTab suit le master : il ne produit rien, il est mené.
  const externe = sync && !surSynthe
  const enCours = externe && current?.id === master?.id

  const actions = useRef({})
  actions.current = { seek, reportEngine }
  // Écoutait-on déjà ce morceau au moment de confier la partition au
  // synthétiseur ? Lu dans une référence : le savoir après coup, une fois la
  // tablature devenue le média courant, ne dirait plus rien.
  const suite = useRef(false)
  suite.current = current?.trackId === trackId
  const sonRef = useRef(false)
  sonRef.current = surSynthe

  // Les écouteurs d'alphaTab sont posés une fois pour toutes, mais le mode,
  // lui, change en cours de route : ils le lisent ici plutôt que dans la
  // fermeture où ils sont nés.
  const modeRef = useRef({})
  modeRef.current = { externe, syntheActif, playing }
  const profilRef = useRef(() => {})

  // Les ordres que le lecteur enverra au synthétiseur : la barre du bas ne sait
  // pas qu'elle parle à alphaTab, elle commande comme elle commande un élément
  // média. Stables, elles ne rebranchent rien à chaque rendu, et elles
  // s'accommodent d'un synthétiseur qui n'existe pas encore — volume et
  // position sont gardés de côté, il naîtra tel qu'on l'a réglé.
  const vivant = () => modeRef.current.syntheActif && apiRef.current
  const commandes = useRef({
    // C'est le premier ordre de lecture qui fait naître le synthétiseur : ni
    // worker ni banque de sons avant qu'on ne demande à entendre.
    play: () => {
      setArme(true)
      if (vivant()) apiRef.current.play()
    },
    pause: () => { if (vivant()) apiRef.current.pause() },
    seek: (secondes) => {
      positionRef.current = secondes * 1000
      if (vivant()) apiRef.current.timePosition = secondes * 1000
    },
    setVolume: (v) => {
      volumeRef.current = v
      if (vivant()) apiRef.current.masterVolume = v
    },
  }).current

  useEffect(() => {
    if (!tablature) return
    let annule = false
    let api = null

    ;(async () => {
      const alphaTab = await import('@coderline/alphatab')
      if (annule) return
      alphaTabRef.current = alphaTab

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
          // On démarre toujours en suiveur : le synthétiseur, lui, se demande.
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
        if (!modeRef.current.externe) return
        const sortie = api.player?.output
        if (!sortie || sortie.handler) return
        sortie.handler = {
          get backingTrackDuration() { return (master?.duration ?? 0) * 1000 },
          get playbackRate() { return 1 },
          set playbackRate(_) {},
          get masterVolume() { return 1 },
          set masterVolume(_) {},
          seekTo(ms) { if (clic.current) actions.current.seek(ms / 1000) },
          // Sans effet : notre lecteur est déjà dans l'état voulu quand
          // alphaTab appelle ces méthodes, puisque c'est lui qui les provoque.
          play() {},
          pause() {},
        }
      }

      // Tablature seule pour les cordes. Une percussion n'en a pas : le profil
      // « Tab » n'y trouve aucune portée à graver et lève une erreur.
      const appliquerProfil = (instance, piste) => {
        const percussion = piste?.staves?.some((s) => s.isPercussion)
        instance.settings.display.staveProfile = percussion
          ? alphaTab.StaveProfile.Default
          : alphaTab.StaveProfile.Tab
        instance.updateSettings()
      }

      api.scoreLoaded.on((score) => {
        appliquerProfil(api, score?.tracks?.[0])
        setPistes((score?.tracks ?? []).map((t) => ({
          index: t.index,
          nom: t.name?.trim() || `Piste ${t.index + 1}`,
        })))
        setPisteActive(0)
        onPistes?.(score?.tracks?.length ?? 0)
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
      profilRef.current = (piste) => appliquerProfil(api, piste)
      api.midiLoaded.on(brancher)
      api.renderFinished.on(brancher)

      // Le synthétiseur, lui, mène la lecture : c'est à lui qu'on demande où il
      // en est. En mode suiveur ces mêmes événements ne font que répéter ce que
      // le lecteur global sait déjà.
      api.playerReady.on(() => {
        if (annule || !modeRef.current.syntheActif) return
        sonPretRef.current = true
        setSonPret(true)
        api.masterVolume = volumeRef.current
        api.timePosition = reprise.current
        // La lecture a pu être demandée avant que la banque de sons n'arrive :
        // c'est même le cas courant, puisque c'est elle qui l'a réclamée.
        if (modeRef.current.playing) api.play()
      })
      api.playerStateChanged.on((e) => {
        if (annule || !modeRef.current.syntheActif) return
        const joue = e.state === alphaTab.synth.PlayerState.Playing
        // Un synthétiseur qui vient de naître s'annonce à l'arrêt, par
        // construction : ce n'est pas une décision, et ça ne doit pas couper
        // l'écoute qu'on lui a confiée en changeant de son.
        if (!joue && !sonPretRef.current) return
        actions.current.reportEngine({ playing: joue })
      })
      api.playerPositionChanged.on((e) => {
        if (annule || !modeRef.current.syntheActif) return
        positionRef.current = e.currentTime
        actions.current.reportEngine({ time: e.currentTime / 1000, duration: e.endTime / 1000 })
      })

      setApiPrete(true)
    })().catch((e) => { if (!annule) { setErreur(String(e?.message ?? e)); setEtat('erreur') } })

    return () => {
      annule = true
      api?.destroy()
      apiRef.current = null
      setApiPrete(false)
    }
  }, [tablature, master, sync, offset, onPistes])

  // Changer de son, c'est changer de lecteur : alphaTab détruit le sien, en
  // crée un autre et régénère le midi. La gravure, elle, ne bouge pas.
  useEffect(() => {
    const api = apiRef.current
    const alphaTab = alphaTabRef.current
    if (!apiPrete || !api || !alphaTab) return
    const mode = syntheActif ? alphaTab.PlayerMode.EnabledSynthesizer : alphaTab.PlayerMode.EnabledExternalMedia
    if (api.settings.player.playerMode === mode) return
    sonPretRef.current = false
    setSonPret(false)
    // Le nouveau lecteur reprendra là où l'autre en était : le synthétiseur par
    // son propre axe, l'enregistrement par le nôtre, décalage compris.
    reprise.current = positionRef.current
    api.settings.player.soundFont = syntheActif ? BANQUE_DE_SONS : null
    api.settings.player.playerMode = mode
    api.updateSettings()
    if (!syntheActif) actions.current.seek((reprise.current + offset) / 1000)
  }, [apiPrete, syntheActif, offset])

  // Les deux sons ne peuvent pas jouer ensemble. Choisir le synthétiseur, c'est
  // confier la lecture à alphaTab : il devient le média courant et la barre du
  // bas le commande. Revenir au master le redésigne, position gardée.
  useEffect(() => {
    if (!surSynthe || !tablature) return
    attachEngine(tablature, commandes, { at: positionRef.current / 1000, resume: suite.current })
    // Au démontage, la référence dit encore « synthétiseur » : aucun rendu n'a
    // eu lieu depuis. C'est ce qui distingue quitter la tablature, où le son
    // doit cesser, d'un simple changement de son, qui se poursuit.
    return () => detachEngine({ resume: !sonRef.current })
  }, [surSynthe, tablature, commandes, attachEngine, detachEngine])

  useEffect(() => {
    if (!surSynthe && sync && master) switchTo(master)
  }, [surSynthe, sync, master, switchTo])

  // alphaTab suit l'état du lecteur. La comparaison évite la boucle : chacun
  // ne réagit que si l'autre a réellement changé.
  useEffect(() => {
    const api = apiRef.current
    if (!externe || !api?.player || etat !== 'pret') return
    const alphaTabJoue = api.player.state === 1
    if (enCours && playing && !alphaTabJoue) api.play()
    else if ((!playing || !enCours) && alphaTabJoue) api.pause()
  }, [externe, playing, enCours, etat])

  useEffect(() => {
    // Tant que la gravure n'est pas finie, alphaTab n'a pas ses données de
    // tempo : lui envoyer une position le fait déréférencer du vide. Le cas se
    // produit quand on ouvre la tablature alors que la lecture est déjà en
    // cours.
    if (!externe || !enCours || etat !== 'pret') return
    positionRef.current = Math.max(0, time * 1000 - offset)
    apiRef.current?.player?.output?.updatePosition?.(time * 1000)
  }, [externe, time, enCours, etat, offset])

  // alphaTab traite le clic au relâchement, sur la partition même : la fenêtre
  // se referme donc quand l'événement remonte jusqu'ici, déplacement fait.
  useEffect(() => {
    const fermer = () => { clic.current = false }
    window.addEventListener('mouseup', fermer)
    return () => window.removeEventListener('mouseup', fermer)
  }, [])

  const choisirPiste = (index) => {
    const api = apiRef.current
    const piste = api?.score?.tracks?.[index]
    if (!piste) return
    setPisteActive(index)
    setEtat('chargement')
    profilRef.current(piste)
    api.renderTracks([piste])
  }

  if (!tablature) return null

  const pastille = (actif) => `rounded-full px-3 py-1 text-xs transition-colors ${
    actif ? 'bg-accent text-white' : 'border border-line-strong text-dim hover:text-bright'
  }`

  return (
    <>
      {/* Pistes à gauche, son à droite : ce qu'on regarde et ce qu'on écoute
          sont deux choix distincts, mais ils tiennent sur la même ligne. */}
      {(pistes.length > 1 || sync) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {pistes.length > 1 && pistes.map((piste) => (
            <button key={piste.index} onClick={() => choisirPiste(piste.index)}
              className={pastille(piste.index === pisteActive)}>
              {piste.nom}
            </button>
          ))}

          {/* Le choix ne se pose que s'il y a un enregistrement à suivre : sans
              master, le synthétiseur est le seul son possible. L'interrupteur
              porte le master, puisque c'est lui l'état ordinaire de
              l'application : l'éteindre, c'est écouter la partition. Le libellé
              fait partie du bouton, et se clique donc aussi. */}
          {sync && (
            <button type="button" role="switch" aria-checked={!surSynthe}
              onClick={() => setSon(surSynthe ? 'master' : 'synthe')}
              className="ml-auto flex shrink-0 items-center gap-2 rounded-full text-xs text-dim transition-colors hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
              <span className={`relative h-5 w-9 rounded-full transition-colors ${
                surSynthe ? 'bg-line-strong' : 'bg-accent'
              }`}>
                <span className={`absolute top-1/2 left-0 size-4 -translate-y-1/2 rounded-full bg-bright shadow transition-transform ${
                  surSynthe ? 'translate-x-0.5' : 'translate-x-[18px]'
                }`} />
              </span>
              Master
            </button>
          )}
        </div>
      )}

      {/* La partition se joue depuis la barre du bas, comme un média : ici, il
          n'y a que l'attente de la banque de sons à signaler. */}
      {surSynthe && arme && !sonPret && (
        <p className="mb-2 text-sm text-faint">Chargement des sons…</p>
      )}

      {etat === 'chargement' && <p className="mb-2 text-sm text-faint">Gravure de la partition…</p>}
      {etat === 'erreur' && (
        <p className="mb-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-dim">
          La partition n’a pas pu être affichée : {erreur}
        </p>
      )}

      <div className={`${hauteur} overflow-auto rounded-xl border border-line bg-surface p-3`}>
        <div ref={surfaceRef} onMouseDown={() => { clic.current = true }} />
      </div>
    </>
  )
}
