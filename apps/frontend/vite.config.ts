import { defineConfig } from "vite";
import mkcert from 'vite-plugin-mkcert'
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), mkcert()],
  resolve: { alias: { "@": "/src" } },
  server: {
    https: true,
    host: "localhost",
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
    },
  },
});
