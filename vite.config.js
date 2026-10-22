import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Configuración de Vite: React, Tailwind y el plugin que convierte la web en PWA
export default defineConfig({
  // './' permite publicar en GitHub Pages dentro de una subcarpeta
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // se actualiza sola cuando publicas cambios
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lumio',
        short_name: 'Lumio',
        description: 'Mis gastos, ingresos y ahorro',
        lang: 'es-CL',
        theme_color: '#0f766e',
        background_color: '#f5f5f4',
        display: 'standalone', // se abre a pantalla completa, sin barra de Safari
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
