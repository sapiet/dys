# dys

Petit site statique (React + Vite) pour centraliser des compositions audio/vidéo.
Déployé sur GitHub Pages : https://sapiet.github.io/dys/

## Développement

```bash
npm install
npm run dev
```

`npm run build` produit `dist/`, `npm run preview` sert ce build en local.

## Déploiement

Automatique à chaque push sur `main` via `.github/workflows/deploy.yml`.
Prérequis côté GitHub : **Settings → Pages → Source = GitHub Actions**.

## Application

React 19 + Vite + Tailwind 4, sans dépendance de routage : la navigation passe
par le hash (`#/track/02`), parce que sur GitHub Pages un rafraîchissement sur
une vraie URL renverrait un 404.

```
src/lib/media.js          index dérivés du manifeste, résolution des URLs
src/lib/useHashRoute.js   routage
src/player/               état de lecture partagé
src/views/                Morceaux, Morceau, Types
src/components/           coquille responsive, barre de lecture
```

### Le lecteur

Deux éléments média, un seul actif à la fois : un `<audio>` persistant monté à
la racine, et un `<video>` monté par la page d'un morceau. Le `PlayerProvider`
conserve le timecode hors du cycle de rendu et le transfère à chaque bascule,
ce qui donne les deux comportements attendus :

- **changer d'angle conserve la position** — passer du master au playthrough
  basse reprend à la seconde près ;
- **le son survit à la navigation** — un master continue de jouer pendant qu'on
  parcourt le reste du site.

Une vidéo, elle, s'arrête quand on quitte la page : elle n'a plus de surface où
s'afficher, et lui faire suivre l'`<audio>` ferait télécharger le fichier deux
fois.

### La file de lecture

Lancer un média depuis la vue « Types » prend le groupe affiché comme file :
à la fin d'un morceau la lecture enchaîne sur le suivant, et reprend au premier
après le dernier. Les playthroughs disposent pour cela de leur propre surface
vidéo dans cette vue — on ne quitte pas la page.

La file est figée au moment où la lecture démarre. Changer de groupe pendant
l'écoute n'y touche pas : l'enchaînement en cours va à son terme. Depuis la page
d'un morceau, aucune file n'est posée et la lecture s'arrête à la fin.

## Médias

### Le principe

`media/` contient la **matière source** : elle est gitignorée, jamais publiée, et
tu y ranges ce que tu veux. `public/media/` contient les **proxies web générés**,
gitignorés eux aussi. Rien de tout ça n'est versionné — seul `src/media.json`,
le manifeste, entre dans le repo.

Il n'y a donc pas de dossier `draft` : ce qui n'est pas prêt reste simplement
hors des dossiers repris par la taxonomie.

### La taxonomie

L'arborescence porte le sens. Elle est lue par `scripts/lib/taxonomy.mjs`, seul
endroit où la convention est définie :

```
media/audio/<morceau>.mp3                   -> master
media/playthrough/<instrument>/<morceau>.*  -> playthrough
```

Le numéro de morceau est sur deux chiffres (`01`, `02`, …). Tout chemin non
reconnu est **ignoré et listé** en fin de traitement, jamais interprété au
jugé — c'est ce qui permet d'ajouter les autres natures (rushes, répètes,
shorts) une par une, sans rien casser.

### Les commandes

```bash
npm run media          # build + manifeste
npm run media:build    # ré-encode media/ -> public/media/
npm run media:manifest # public/media/ + media.meta.json -> src/media.json
```

`media:build` est idempotent : il ne retouche que les fichiers dont la source a
changé (`--force` pour tout refaire, `--dry` pour voir sans exécuter). Il ne
recompresse que ce qui le mérite — au-delà de 2,8 Mbit/s il ré-encode en H.264
CRF 23, en dessous il se contente de remuxer en `+faststart`, ce qui est
instantané et sans perte. Les MP3 en 320 kbps sont copiés tels quels : un
ré-encodage lossy vers lossy dégraderait pour un gain négligeable.

### Ce que le script ne peut pas deviner

`media.meta.json`, à la racine, est le seul fichier écrit à la main. Il ne porte
que l'éditorial — titres des morceaux, notes — que le manifeste fusionne avec ce
qu'il a mesuré. Une entrée absente retombe sur « #02 ».

### Publication des médias

Point ouvert : `public/media/` étant gitignoré, la CI ne dispose pas des
fichiers et le site déployé pointerait dans le vide. Le manifeste stocke des
chemins **relatifs** et un `baseUrl`, précisément pour qu'on puisse basculer
vers un hébergement externe (Cloudflare R2) sans toucher à l'application.
À trancher avant la première mise en ligne.

## Confidentialité


Un site GitHub Pages est **public**, même depuis un repo privé (le contrôle
d'accès sur Pages est réservé à Enterprise). La discrétion repose uniquement sur
le fait que l'URL n'est pas diffusée. `robots.txt` et la balise `noindex`
bloquent l'indexation, rien de plus.
