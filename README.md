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

### Des URLs partageables

L'URL porte tout ce qui identifie un média, pour qu'un lien ouvre exactement ce
que voyait l'expéditeur :

```
#/media/playthrough-bass         un groupe
#/media/playthrough-bass/04      un média précis
#/track/04                       un morceau
#/track/04/playthrough-bass      un morceau vu sous un angle
```

Les deux vues manipulent les mêmes identifiants — groupe et morceau — dans
l'ordre correspondant à leur entrée.

Ouvrir un lien **tente** de lancer la lecture. Les navigateurs la refusent tant
que l'utilisateur n'a pas interagi avec le site : la tentative aboutit dans
l'application installée et chez les visiteurs habitués — Chrome mesure
l'engagement — et échoue chez qui découvre le site. Le rejet est capté dans
`PlayerContext`, qui repasse l'état à l'arrêt : le média reste en place, prêt,
et le bouton affiche « Lecture ».

Seule l'arrivée sur un lien tente la lecture ; les navigations internes passent
par un clic, qui décide lui-même.

Quand le navigateur refuse, une boîte de dialogue propose un bouton — ce clic
est précisément le geste qui débloque la lecture. Elle **ne s'affiche que dans
ce cas** : dans l'application installée, où la lecture aboutit, elle ne paraît
jamais. `PlayerContext` distingue pour cela un `NotAllowedError` d'un
`AbortError`, ce dernier n'étant qu'un changement de source en cours de
chargement.

### Copier et partager

À côté du téléchargement, sur la page d'un morceau et sous le lecteur de la vue
Médias. Le lien est **construit depuis l'item**, pas lu dans la barre
d'adresse : celle-ci ne précise pas toujours l'angle affiché.

Le bouton de partage n'apparaît que si `navigator.share` existe — absent des
navigateurs de bureau sous Windows et Linux, où mieux vaut le masquer que
l'afficher inerte. Le presse-papiers exigeant un contexte sécurisé, une
invite manuelle prend le relais s'il est indisponible.

Les changements de sélection utilisent `replaceState` : sans cela, chaque clic
sur un filtre empilerait une entrée d'historique et le bouton retour obligerait
à les défaire un par un.

URL et lecteur se désignent mutuellement, ce qui invite à la boucle. Un seul
effet s'en charge, en regardant laquelle des deux sources vient de changer —
deux effets séparés se combattaient, celui qui restaure depuis l'URL annulant
celui qui suit l'enchaînement.

### Documents

Une tablature ne se joue pas : ni durée, ni piste, ni file de lecture. Le
manifeste les tient donc à l'écart des `items`, dans un tableau `documents`.
Les mêler aurait exigé des garde-fous dans tout le code de lecture, pour deux
fichiers.

Elles apparaissent comme un quatrième groupe dans la vue Médias, avec
téléchargement, copie et partage mais sans bouton de lecture, et sur la page
d'un morceau à côté des autres commandes.

### La tablature défile sur le master

La tablature est un **angle du morceau**, au même titre que le master ou un
playthrough : `#/track/<morceau>/tab`. La sélectionner grave la partition avec
alphaTab dans le cadre du morceau et fait défiler le curseur sur
l'enregistrement — pas sur un synthétiseur MIDI.

Elle n'entre pas pour autant dans la liste des angles que parcourt le code de
lecture : ce n'est pas un média, elle n'a ni durée ni piste audio.

Le master est désigné dès l'arrivée sur la page, sans être lancé : la barre du
lecteur est présente d'emblée et c'est elle qui commande. La page n'a pas de
bouton à elle, qui ferait doublon.

**alphaTab suit, il ne commande pas.** Le lecteur global garde l'élément audio ;
alphaTab reçoit un gestionnaire dont `play` et `pause` sont volontairement
vides, et sa position est alimentée par le temps du lecteur. Les deux sens de
pilotage se combattaient : alphaTab lançait notre lecteur, qui le relançait, et
l'audio finissait en pause pendant qu'alphaTab se croyait en lecture. Seul le
déplacement remonte, quand on clique une mesure.

Trois points ont demandé du temps, et méritent d'être notés :

- **Les workers sont désactivés** (`core.useWorkers: false`). Celui d'alphaTab
  ne résout pas ses imports internes avec notre `base` et fait échouer le
  serveur de développement. La gravure des 93 mesures prend 43 ms : le fil
  principal suffit.
- **La police de notation.** Le plugin Vite la fait chercher à côté du script
  d'alphaTab alors qu'il la copie à la racine ; le repli SPA renvoyait
  `index.html`, et le rendu ne démarrait jamais. D'où le `fontDirectory`
  explicite.
- **Les curseurs n'ont aucune couleur.** alphaTab les positionne mais laisse la
  page les styler — sans les règles de `index.css`, ils suivent la musique en
  restant invisibles.
- **Un point de synchronisation est obligatoire.** Sans lui, alphaTab n'a pas de
  correspondance entre son axe temporel et l'audio, et refuse de démarrer. Un
  seul, sur la première mesure, a suffi : 127 ms d'écart après 157 secondes de
  lecture. `media.meta.json` accepte un `tabOffset` par morceau pour les
  enregistrements qui ne commencent pas sur le premier temps.

`media.meta.json` accepte un `tabSync` par morceau. À `false`, la tablature ne
se cale pas sur l'enregistrement — c'est le cas du morceau 07, dont la
partition n'est pas encore à jour. Elle se consulte alors en silence, sans
barre de lecteur, ce qui vaut aussi pour un morceau sans master.

L'affichage se limite à la tablature, sans la portée en notation — sauf pour
les percussions, qui n'ont pas de tablature : le profil « Tab » n'y trouve
aucune portée à graver et lève une erreur. Le profil est donc choisi selon la
piste.

Un fichier Guitar Pro porte toutes les pistes du morceau — Massacre en a cinq.
alphaTab n'en grave qu'une à la fois : des pastilles permettent de choisir
laquelle regarder, et la synchronisation survit au changement.

Le fichier `.gp5` reste téléchargeable pour qui veut l'éditer.

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

Les filtres de la vue « Médias » sont à deux étages, nature puis instrument.
À plat, leur nombre serait multiplicatif — une pastille par couple, et
« Playthrough » répété autant de fois qu'il y a d'instruments. Choisir une
nature sélectionne automatiquement son premier instrument, et le second étage
se masque quand il n'y a rien à départager.

L'imbrication est produite par `media:manifest` : ajouter une nature ou un
instrument ne demande aucune modification de l'interface.

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

Android et desktop proposent l'installation via `beforeinstallprompt`, capté par
`src/pwa/install.js` et relayé par un bandeau en tête de contenu.

**iOS n'expose aucune API d'installation, quel que soit le navigateur.** Le
bandeau ne peut qu'indiquer le geste, et le chemin de menu diffère : « bouton
Partager » dans Safari, « menu ⋯ » dans Chrome, Firefox ou Edge. Il est donc
détecté, une consigne erronée n'étant pas plus utile qu'aucune consigne.

Vérifié sur appareil : Chrome sur iOS produit bien une application autonome,
sans barre d'adresse — contrairement à ce qu'on lit souvent.

Le nom affiché sous l'icône vient de `apple-mobile-web-app-title` sur iOS, qui
prime sur le manifeste, et de `short_name` ailleurs. Les deux valent
« Drown Your Sorrows ». **iOS tronque l'affichage** au-delà d'une douzaine de
caractères : l'icône montrera « Drown Your… ». Renommer plus tard n'affecte pas
les icônes déjà posées, iOS ne les met pas à jour — il faut les supprimer et
les réinstaller.

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

L'arborescence porte le sens, et suit une forme unique :

```
<support>/<nature>[/<instrument>]/<morceau>.<ext>
```

```
media/audio/master/01.mp3                 -> master
media/audio/backing-tracks/drums/01.mp3   -> backing track, batterie
media/video/playthrough/bass/01.mp4       -> playthrough, basse
```

Les documents, qui n'ont ni support ni durée, se rangent à la racine sur deux
segments :

```
media/tabs/04.gp5                         -> tablature du morceau 04
```

Les natures connues sont déclarées dans `scripts/lib/taxonomy.mjs`, seul
endroit à modifier pour en ajouter une — la table y déclare aussi la
profondeur attendue, ce qui évite un cas particulier dans l'analyse du chemin — l'interface n'a rien à savoir, les
regroupements de la vue « Médias » étant dérivés dans le manifeste.

Le numéro de morceau est sur deux chiffres. Le nombre de segments doit
correspondre exactement : une nature à instrument rangée sans instrument, ou
l'inverse, est **ignorée et signalée** plutôt que rattrapée au jugé. Tout
chemin non reconnu l'est aussi — c'est ce qui permet d'ajouter les natures
restantes (rushes, répètes, shorts) une par une, sans rien casser.

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
