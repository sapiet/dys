// Styles partagés par les commandes d'une ligne de média. Définis ici plutôt
// que dupliqués dans chaque composant : copier, partager et télécharger doivent
// se ressembler, et trois chaînes séparées finiraient par diverger.

// Pastille pleine plutôt que contour : trois rectangles cerclés côte à côte
// alourdissent la ligne, là où un fond doux suffit à dire « commande ». Le fond
// est `raised`, plus clair que celui que prend la ligne au survol — sans quoi
// les boutons disparaîtraient au passage de la souris.
const BASE = 'shrink-0 rounded-full bg-raised text-dim transition hover:bg-line-strong hover:text-bright active:scale-95'

export const CONTROLE_ICONE = `${BASE} grid size-9 place-items-center`

// Le libellé se masque sous `sm` : sans ce retrait réduit, la pastille garderait
// sa largeur et encadrerait une icône seule de vide.
export const CONTROLE_LIBELLE = `${BASE} inline-flex items-center gap-2 px-2.5 py-2 text-[13px] sm:px-4`
