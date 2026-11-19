import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function fixSwitchPolyfillResolve(): Plugin {
  return {
    name: 'fix-input-switch-polyfill-resolve',
    transform(code, id) {
      if (id.includes('input-switch-polyfill')) {
        return {
          code: code.replace(
            "import.meta.resolve('./input-switch-polyfill.css')",
            "new URL('./input-switch-polyfill.css', import.meta.url).href"
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), fixSwitchPolyfillResolve()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4141',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
