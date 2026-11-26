import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  KOLMO_ROLLDOWN_BUILD,
  KOLMO_SINGLETON_DEDUPE,
  externalizeRapierWasm,
} from "@pinkaphant/kolmo/vite";

export default defineConfig({
  plugins: [react(), externalizeRapierWasm()],
  resolve: { dedupe: KOLMO_SINGLETON_DEDUPE },
  build: KOLMO_ROLLDOWN_BUILD,
});
