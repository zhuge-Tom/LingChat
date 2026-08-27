import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async ({ command }) => ({
  plugins: [vue(), ...(command === 'serve' ? [VueDevTools()] : []), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching some files
      ignored: ['**/src-tauri/**', '**/.venv/**', '**/target/**', '**/data/**'],
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) return 'vue'
          if (id.includes('vue-i18n') || id.includes('@intlify')) return 'i18n'
          if (id.includes('opencc-js')) return 'opencc'
          if (id.includes('lucide-vue-next')) return 'icons'
          if (id.includes('marked')) return 'marked'
          if (id.includes('cropperjs')) return 'cropper'
        },
      },
    },
  },

  // 依赖优化配置
  optimizeDeps: {
    exclude: ['src-tauri/*'],
  },
}))