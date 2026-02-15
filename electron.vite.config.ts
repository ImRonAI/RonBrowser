import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/electron',
      rollupOptions: {
        external: ['electron'],
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/electron',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'electron/preload.ts'),
          preload_external: resolve(__dirname, 'electron/preload-external.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    server: {
      watch: {
        // Prevent dev-server reload storms from nested tool repos.
        ignored: ['**/agent/tools/**', '**/dist/**'],
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@catalyst': resolve(__dirname, './src/components/catalyst')
      }
    },
    optimizeDeps: {
      include: ['three', '@react-three/fiber', '@react-three/drei']
    },
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        },
        external: ['vscode-jsonrpc', 'langium']
      }
    }
  }
})
