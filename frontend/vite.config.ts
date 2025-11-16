import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
	base: process.env.VITE_GITHUB_PAGES ? "/Tayeb/" : "/",
	plugins: [react(), wasm(), topLevelAwait()],
	build: {
		rollupOptions: {
			// Externalize wasm-heavy math packages if needed
			external: [
				/@galacticcouncil\/math-.*/,
			],
		},
	},
});
