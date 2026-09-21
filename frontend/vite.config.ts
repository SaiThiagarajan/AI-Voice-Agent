import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allows the dev server to accept requests forwarded through a Cloudflare
    // Tunnel quick-tunnel (random *.trycloudflare.com hostname) for temporary
    // demos. Vite's Host-header allow-list would otherwise reject these with
    // "Blocked request" (DNS-rebinding protection) since the tunnel forwards
    // the visitor's original Host header straight through to this dev server.
    allowedHosts: [".trycloudflare.com"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
