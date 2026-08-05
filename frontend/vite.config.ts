import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // The Workers API (`npm run dev` in workers/) serves on 8787. Set
  // VITE_API_PROXY_TARGET=http://127.0.0.1:8000 in frontend/.env.local to develop
  // against the original FastAPI backend instead.
  const env = loadEnv(mode, __dirname, "VITE_");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
