import { useState } from 'react'

const COPIER = 'M8 5h9a2 2 0 0 1 2 2v9M16 9v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z'
const VALIDE = 'M5 13l4 4L19 7'
const PARTAGE = 'M12 3v13M12 3 8 7M12 3l4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4'

function Icone({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const classe = 'inline-flex shrink-0 items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-[13px] text-dim transition-colors hover:bg-surface hover:text-bright'

export function ShareButtons({ url, title }) {
  const [copie, setCopie] = useState(false)

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
        aria-label={copie ? 'Lien copié' : 'Copier le lien'}>
        <Icone path={copie ? VALIDE : COPIER} />
        <span className="hidden sm:inline">{copie ? 'Copié' : 'Copier le lien'}</span>
      </button>

      {/* L'API de partage n'existe pas sur les navigateurs de bureau sous
          Windows ou Linux : mieux vaut masquer le bouton que l'afficher inerte. */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button onClick={partager} className={classe} aria-label="Partager">
          <Icone path={PARTAGE} />
          <span className="hidden sm:inline">Partager</span>
        </button>
      )}
    </>
  )
}
