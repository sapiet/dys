import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

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

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    siteUrl,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: BASE,
        name: 'Drown Your Sorrows',
        // Volontairement identique à `name` : « DYS » n'évoquait rien sur
        // l'écran d'accueil. iOS tronquera l'affichage, pas le nom.
        short_name: 'Drown Your Sorrows',
        description: 'Compositions, playthroughs et captations.',
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
        globIgnores: ['media/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
