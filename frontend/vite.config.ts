import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Default for running Vite directly on host machine.
  // In Docker dev (`frontend_dev` service), `VITE_BACKEND_URL` is set to `http://backend:8000`.
  const backendTarget = env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      allowedHosts: [".trycloudflare.com"],
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          ws: true
        },
        "/docs": backendTarget,
        "/openapi.json": backendTarget
      }
    }
  };
});
