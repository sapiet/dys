import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { alphaTab } from '@coderline/alphatab-vite'

// Le site est servi sous https://sapiet.github.io/dys/ : sans ce `base`,
// les assets sont demandés à la racine du domaine et la page reste blanche.
const BASE = '/dys/'

// Les robots d'aperçu ne résolvent pas les URLs relatives : `og:image` et
// `og:url` doivent être absolues. Défini ici pour n'avoir qu'un endroit à
// changer le jour où un domaine propre remplacerait github.io.
const SITE_URL = 'https://sapiet.github.io/dys/'

const siteUrl = {
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
}

// Le plugin d'alphaTab injecte dans ses workers — celui du synthétiseur comme
// celui de la gravure — un import de l'environnement de Vite préfixé par notre
// `base` : `/dys/@vite/env`. Le serveur de développement ne connaît que
// `/@vite/env` et refuse de résoudre l'autre, ce qui fait échouer le worker.
// Ce renvoi rétablit la résolution ; au build, l'import n'existe pas.
const alphaTabWorkerEnv = {
  name: 'alphatab-worker-env',
  apply: 'serve',
  resolveId(id) {
    return id === `${BASE}@vite/env` ? this.resolve('/@vite/env') : null
  },
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    siteUrl,
    alphaTabWorkerEnv,
    // Copie la police de notation et configure les workers. alphaTab n'est
    // chargé qu'à l'ouverture d'une tablature, via un import dynamique.
    alphaTab(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: BASE,
        name: 'Drown Your Sorrows',
        // Volontairement identique à `name` : « DYS » n'évoquait rien sur
        // l'écran d'accueil. iOS tronquera l'affichage, pas le nom.
        short_name: 'Drown Your Sorrows',
        description: 'Compositions, playthroughs et backing tracks.',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#090c12',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le précache se limite à la coquille applicative. Sans ce filtre,
        // Workbox embarquerait les 649 Mo de `public/media` et l'installation
        // dépasserait les quotas du navigateur.
        globPatterns: ['**/*.{js,css,html}', 'icons/*.png', 'image/logo-wide.jpg', 'robots.txt'],
        // Les workers d'alphaTab pèsent 2,3 Mo chacun : hors de question de les
        // précacher, et le plugin considère un dépassement de taille comme une
        // erreur tant qu'on ne les a pas écartés explicitement.
        globIgnores: ['media/**', 'assets/alphaTab*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
