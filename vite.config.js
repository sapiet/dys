import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Le site est servi sous https://sapiet.github.io/dys/ : sans ce `base`,
// les assets sont demandés à la racine du domaine et la page reste blanche.
export default defineConfig({
  base: '/dys/',
  plugins: [react(), tailwindcss()],
})
