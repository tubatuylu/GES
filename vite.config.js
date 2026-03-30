import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // All /tkgm-api/* requests are forwarded to TKGM's CBS API (bypasses CORS in dev)
      '/tkgm-api': {
        target: 'https://cbsapi.tkgm.gov.tr',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tkgm-api/, '/megsiswebapi.v3/api'),
        // Mimic a real browser request from TKGM's own parselsorgu site
        headers: {
          'Referer': 'https://parselsorgu.tkgm.gov.tr/',
          'Origin': 'https://parselsorgu.tkgm.gov.tr',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
      },
    },
  },
})
