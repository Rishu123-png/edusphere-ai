
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: false, // use public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-cache', networkTimeoutSeconds: 10, expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60*60*24*365 } }
          },
          {
            /* Face-AI model files (12 MB) — download once, then every
               attendance scan opens instantly from cache even on 3G */
            urlPattern: /\/models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-models-local',
              expiration: { maxEntries: 24, maxAgeSeconds: 60*60*24*365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            /* Same for the CDN fallback used when public/models isn't deployed */
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/justadudewhohacks\/face-api\.js.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-models-cdn',
              expiration: { maxEntries: 24, maxAgeSeconds: 60*60*24*365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('face-api.js') || id.includes('@tensorflow')) return 'vendor-face-api'
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return 'vendor-pdf'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts'
          if (id.includes('framer-motion') || id.includes('animejs')) return 'vendor-animation'
          if (id.includes('lucide-react')) return 'vendor-icons'
        }
      }
    },
    chunkSizeWarningLimit: 900
  },
  server: {
    host: true,
    port: 5173
  }
})
