import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  base: '/run-vision/',
  plugins: [vue(), vueDevTools(), vuetify()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // MapLibre alone is ~800 kB minified; it is split out and cached separately.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ },
            { name: 'mediabunny', test: /node_modules[\\/]mediabunny/ },
            { name: 'vue-vendor', test: /node_modules[\\/](vue|@vue|vue-router|pinia|vuetify)[\\/]/ },
          ],
        },
      },
    },
  },
});
