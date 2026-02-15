import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  envDir: "../../",
  envPrefix: ["VITE_", "OPENAI_", "INWORLD_", "TTS_"],
  server: {
    proxy: {
      "/graphql": {
        target: "http://localhost:4001",
        ws: true,
      },
    },
  },
});
