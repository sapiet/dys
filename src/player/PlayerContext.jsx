import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getItem, isVideo, primarySource, resolveUrl } from '../lib/media'

const PlayerContext = createContext(null)

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer doit être utilisé dans un PlayerProvider')
  return value
}

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const [videoEl, setVideoEl] = useState(null)
  const [currentId, setCurrentId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  // Le navigateur a refusé une lecture faute d'interaction préalable. On le
  // signale au lieu de l'avaler : c'est ce qui permet de proposer un bouton.
  const [blocked, setBlocked] = useState(false)
  // File de lecture : les ids parcourus en boucle quand un média se termine.
  // Vide ou à un seul élément, la lecture s'arrête simplement à la fin.
  const [queue, setQueue] = useState([])

  // Le timecode vit hors du cycle de rendu : c'est lui qu'on transfère d'un
  // élément à l'autre au changement d'angle.
  const timeRef = useRef(0)
  const pendingSeek = useRef(null)

  // Un moteur externe peut prendre la place de l'élément média : la tablature
  // produit son son elle-même et ne saurait que faire d'une source. Le lecteur
  // lui envoie alors ses ordres au lieu d'un fichier, et reçoit sa position en
  // retour — la barre du bas reste l'unique transport de l'application.
  const engine = useRef(null)
  const engineIdRef = useRef(null)
  const [engineId, setEngineId] = useState(null)

  // L'id courant hors du cycle de rendu : le moteur qui se retire doit savoir
  // si un média a déjà pris sa place, et il l'apprend depuis une fermeture.
  const currentIdRef = useRef(null)
  currentIdRef.current = currentId

  const current = currentId ? getItem(currentId) : null
  const url = current ? resolveUrl(primarySource(current).path) : null

  // Chaque nature a son élément, et un seul. Faire porter une source vidéo au
  // <audio> de repli lui ferait télécharger le fichier une seconde fois.
  const active = current && !engineId ? (isVideo(current) ? videoEl : audioRef.current) : null

  useEffect(() => {
    if (!active || !url) return
    const wanted = new URL(url, window.location.href).href
    if (active.src === wanted) return
    pendingSeek.current = timeRef.current
    active.src = url
  }, [active, url])

  // `currentTime` ne tient pas tant que les métadonnées ne sont pas là : on
  // reporte le positionnement plutôt que de l'appliquer dans le vide.
  useEffect(() => {
    if (!active) return

    const apply = () => {
      setDuration(active.duration || 0)
      if (pendingSeek.current === null) return
      active.currentTime = Math.min(pendingSeek.current, active.duration || pendingSeek.current)
      pendingSeek.current = null
    }

    if (active.readyState >= 1) apply()
    active.addEventListener('loadedmetadata', apply)
    return () => active.removeEventListener('loadedmetadata', apply)
  }, [active, url])

  useEffect(() => {
    // Le moteur externe n'a ni source à charger ni promesse à attendre : on lui
    // passe l'ordre tel quel.
    if (engineId) {
      if (playing) engine.current?.play()
      else engine.current?.pause()
      return
    }
    if (!active) return

    if (!playing) {
      active.pause()
      return
    }

    // Appeler play() pendant le chargement de la source rejette la promesse en
    // AbortError. On attend que l'élément soit prêt plutôt que d'abandonner.
    const start = () => active.play()
      .then(() => setBlocked(false))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setPlaying(false)
        if (error.name === 'NotAllowedError') setBlocked(true)
      })

    if (active.readyState >= 2) {
      start()
      return
    }
    active.addEventListener('canplay', start, { once: true })
    return () => active.removeEventListener('canplay', start)
  }, [active, url, playing, engineId])

  useEffect(() => {
    if (engineId) engine.current?.setVolume(volume)
    else if (active) active.volume = volume
  }, [active, volume, engineId])

  // L'élément qui vient de perdre la main doit se taire : sans ça, passer du
  // master à un playthrough laisse les deux jouer ensemble.
  useEffect(() => {
    const audio = audioRef.current
    if (audio && active !== audio && !audio.paused) audio.pause()
    if (videoEl && active !== videoEl && !videoEl.paused) videoEl.pause()
  }, [active, videoEl])

  // Quitter la page d'un morceau démonte le <video> : la lecture s'arrête, et
  // l'état doit le refléter plutôt que d'afficher une pause mensongère. On ne
  // réagit qu'au démontage : au montage, l'élément est brièvement absent le
  // temps d'un rendu, et couper la lecture là casserait le changement d'angle.
  const hadVideo = useRef(false)
  useEffect(() => {
    // Uniquement si l'item courant est toujours une vidéo : revenir au master
    // fait aussi disparaître le <video>, mais la lecture doit se poursuivre.
    if (hadVideo.current && !videoEl && current && isVideo(current)) setPlaying(false)
    hadVideo.current = Boolean(videoEl)
  }, [videoEl, current])

  const advance = useCallback((step) => {
    const index = queue.indexOf(currentId)
    if (index === -1 || queue.length < 2) return false
    const next = getItem(queue[(index + step + queue.length) % queue.length])
    if (!next) return false
    timeRef.current = 0
    setTime(0)
    setDuration(next.duration)
    setCurrentId(next.id)
    return true
  }, [queue, currentId])

  useEffect(() => {
    if (!active) return
    const onTime = () => {
      timeRef.current = active.currentTime
      setTime(active.currentTime)
    }
    // Enchaîner sans toucher à `playing` : la lecture se poursuit d'elle-même
    // sur l'élément suivant, et boucle au bout de la file.
    const onEnd = () => {
      if (!advance(1)) setPlaying(false)
    }
    active.addEventListener('timeupdate', onTime)
    active.addEventListener('ended', onEnd)
    return () => {
      active.removeEventListener('timeupdate', onTime)
      active.removeEventListener('ended', onEnd)
    }
  }, [active, advance])

  const play = useCallback((item, { at, queue: nextQueue } = {}) => {
    setQueue(nextQueue ?? [item.id])
    if (item.id !== currentId) {
      timeRef.current = at ?? 0
      setTime(timeRef.current)
      setDuration(item.duration)
      setCurrentId(item.id)
    } else if (at !== undefined) {
      timeRef.current = at
    }
    setPlaying(true)
  }, [currentId])

  // Désigner un média sans le lancer : c'est ce qu'attend l'ouverture d'un lien
  // partagé, les navigateurs refusant de toute façon une lecture automatique.
  const select = useCallback((item, { queue: nextQueue } = {}) => {
    setQueue(nextQueue ?? [item.id])
    if (item.id === currentId) return
    timeRef.current = 0
    setTime(0)
    setDuration(item.duration)
    setCurrentId(item.id)
  }, [currentId])

  // Changer d'angle, c'est la même œuvre vue autrement : la position se
  // conserve et l'état de lecture ne bouge pas.
  const switchTo = useCallback((item) => {
    if (item.id === currentId) return
    setCurrentId(item.id)
    setDuration(item.duration)
  }, [currentId])

  // Confier la lecture à un moteur : il devient le média courant, à la position
  // qu'on lui donne. L'élément qui jouait se tait de lui-même, n'étant plus
  // l'élu. `resume` dit si la lecture se poursuit : changer de son au milieu
  // d'un morceau ne l'interrompt pas, y arriver ne la déclenche pas.
  const attachEngine = useCallback((item, controls, { at = 0, resume = false } = {}) => {
    engine.current = controls
    engineIdRef.current = item.id
    setEngineId(item.id)
    setQueue([item.id])
    setCurrentId(item.id)
    timeRef.current = at
    setTime(at)
    setDuration(0)
    if (!resume) setPlaying(false)
  }, [])

  // Le moteur s'en va. Si un média a déjà pris sa place — on a choisi un autre
  // angle — rien à défaire. Sinon plus rien n'est désigné, et la lecture
  // s'arrête : sans ça, elle attendrait le prochain média pour se réveiller
  // toute seule. `resume` la préserve, le temps de passer le relais.
  const detachEngine = useCallback(({ resume = false } = {}) => {
    const parti = engineIdRef.current
    engine.current = null
    engineIdRef.current = null
    setEngineId(null)
    if (currentIdRef.current !== parti) return
    setCurrentId(null)
    if (!resume) setPlaying(false)
  }, [])

  // Le moteur dit où il en est : sa position pendant qu'il joue, la durée que
  // la partition lui donne, et l'arrêt qu'il décide seul en fin de morceau.
  const reportEngine = useCallback((etat) => {
    if (etat.time !== undefined) {
      timeRef.current = etat.time
      setTime(etat.time)
    }
    if (etat.duration !== undefined) setDuration(etat.duration)
    if (etat.playing !== undefined) setPlaying(etat.playing)
  }, [])

  const toggle = useCallback(() => {
    if (!currentId) return
    setBlocked(false)
    setPlaying((p) => !p)
  }, [currentId])

  const dismissBlocked = useCallback(() => setBlocked(false), [])

  const seek = useCallback((seconds) => {
    timeRef.current = seconds
    setTime(seconds)
    // La référence plutôt que l'état : le moteur peut s'être retiré à l'instant,
    // et c'est justement là qu'on lui reprend sa position.
    if (engine.current) {
      engine.current.seek(seconds)
      return
    }
    // Sans élément désigné — la tablature vient de rendre la main — la position
    // est reportée comme au changement de source, et s'applique dès qu'un média
    // reprend la main.
    if (active) active.currentTime = seconds
    else pendingSeek.current = seconds
  }, [active])

  const setVolume = useCallback((v) => setVolumeState(v), [])

  const value = useMemo(
    () => ({
      current, playing, time, duration, volume, queue, blocked, dismissBlocked,
      // L'élément actif, pour les usages qui doivent parler au média lui-même
      // — la tablature doit lui déléguer volume et vitesse de lecture.
      mediaElement: active,
      videoMounted: Boolean(videoEl),
      play, select, switchTo, toggle, seek, setVolume, setVideoEl,
      attachEngine, detachEngine, reportEngine,
      next: () => advance(1),
      previous: () => advance(-1),
    }),
    [current, playing, time, duration, volume, queue, blocked, dismissBlocked, active, videoEl, play, select, switchTo, toggle, seek, setVolume, advance, attachEngine, detachEngine, reportEngine],
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" hidden />
    </PlayerContext.Provider>
  )
}
