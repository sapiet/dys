import { useState } from 'react'
import { CONTROLE_ICONE, CONTROLE_LIBELLE } from './controlStyles'

const COPIER = 'M8 5h9a2 2 0 0 1 2 2v9M16 9v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z'
const VALIDE = 'M5 13l4 4L19 7'
const PARTAGE = 'M12 3v13M12 3 8 7M12 3l4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4'

function Icone({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export function ShareButtons({ url, title, compact = false }) {
  const [copie, setCopie] = useState(false)
  const classe = compact ? CONTROLE_ICONE : CONTROLE_LIBELLE
  // Répété par ligne, un libellé générique rendrait la liste illisible au
  // lecteur d'écran : on y adjoint le titre du média.
  const suffixe = compact ? ` — ${title}` : ''

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Le presse-papiers exige un contexte sécurisé ; en local sur http on
      // retombe sur la sélection manuelle plutôt que d'échouer en silence.
      window.prompt('Copier le lien :', url)
      return
    }
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  const partager = async () => {
    try {
      await navigator.share({ title, url })
    } catch {
      // Annulation par l'utilisateur : rien à signaler.
    }
  }

  return (
    <>
      <button onClick={copier} className={classe}
        aria-label={(copie ? 'Lien copié' : 'Copier le lien') + suffixe}>
        <Icone path={copie ? VALIDE : COPIER} />
        {!compact && <span className="hidden sm:inline">{copie ? 'Copié' : 'Copier le lien'}</span>}
      </button>

      {/* L'API de partage n'existe pas sur les navigateurs de bureau sous
          Windows ou Linux : mieux vaut masquer le bouton que l'afficher inerte. */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button onClick={partager} className={classe} aria-label={`Partager${suffixe}`}>
          <Icone path={PARTAGE} />
          {!compact && <span className="hidden sm:inline">Partager</span>}
        </button>
      )}
    </>
  )
}
