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
src/views/                Médias (accueil), Morceaux, Morceau
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

Lancer un média depuis la vue « Médias » prend le groupe affiché comme file :
à la fin d'un morceau la lecture enchaîne sur le suivant, et reprend au premier
après le dernier. Les playthroughs disposent pour cela de leur propre surface
vidéo dans cette vue — on ne quitte pas la page.

La file est figée au moment où la lecture démarre. Changer de groupe pendant
l'écoute n'y touche pas : l'enchaînement en cours va à son terme. Depuis la page
d'un morceau, aucune file n'est posée et la lecture s'arrête à la fin.

## PWA

Le site est installable (`vite-plugin-pwa`, mode `generateSW`). Icônes générées
depuis le logo, dont une variante `maskable` dont le lettrage tient dans la zone
sûre des 80 %.

### Ce qui est mis en cache, et ce qui ne l'est pas

Le précache se limite à la **coquille applicative** — 10 entrées, ~600 Ko.
Laissé à ses réglages par défaut, Workbox embarquerait tout `dist`, soit les
649 Mo de médias, et l'installation dépasserait les quotas du navigateur. D'où
le `globPatterns` restrictif dans `vite.config.js`.

**Les médias ne sont donc pas disponibles hors ligne.** C'est délibéré : les
fichiers audio et vidéo se lisent par requêtes `Range`, que le cache ne sert pas
correctement sans `workbox-range-requests`. Une lecture hors ligne demanderait
ce module, une stratégie de cache explicite et une gestion du quota — un
chantier à part entière, à ouvrir seulement si le besoin se confirme.

Vérifié : le service worker laisse passer les requêtes `Range` sans les
intercepter, la lecture et le déplacement dans la piste fonctionnent, et le
cache reste à 1 Mo après lecture.

### Installation

Android et desktop proposent l'installation spontanément. **iOS ne le fait
pas** : il faut passer par « Partager → Sur l'écran d'accueil » dans Safari.

### Mise à jour

`registerType: 'autoUpdate'` : le service worker se met à jour tout seul à la
navigation suivante. Compter un chargement de décalage après un déploiement
avant que la nouvelle version soit servie.

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

## Aperçus de partage

Balises Open Graph et Twitter Card dans `index.html`, avec une image
`public/og.jpg` au format 1200 × 630 générée depuis le logo.

Les URLs doivent être **absolues** — les robots d'aperçu ne résolvent pas le
relatif. `%SITE_URL%` est injecté au build par un petit plugin de
`vite.config.js`, seul endroit à modifier si un domaine propre remplace un jour
github.io.

### Le site est explorable, délibérément

`robots.txt` disait `Disallow: /` et `index.html` portait un `noindex`. Les deux
empêchaient les aperçus : les robots de Slack, Discord, Facebook, LinkedIn et
WhatsApp respectent `robots.txt`, et certains services renoncent devant un
`noindex`.

Les aperçus ayant été jugés prioritaires sur la discrétion, les deux ont été
levés. **Le site peut donc apparaître dans les résultats de recherche.** Pour
revenir en arrière, remettre le `noindex` dans `index.html` suffit — mais les
vignettes de partage deviendront aléatoires selon les plateformes.

## Confidentialité


Un site GitHub Pages est **public**, même depuis un repo privé (le contrôle
d'accès sur Pages est réservé à Enterprise). La discrétion repose uniquement sur
le fait que l'URL n'est pas diffusée. `robots.txt` et la balise `noindex`
bloquent l'indexation, rien de plus.
