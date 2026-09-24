import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "./package.json";
import dts from "vite-plugin-dts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];

export default defineConfig({
  build: {
    // Same syntax level the package has always shipped (vite 7 would default
    // to a newer baseline, e.g. native class fields).
    target: "es2020",
    minify: false,
    rollupOptions: {
      external: dependencies,
      output: {
        globals: Object.fromEntries(dependencies.map((v) => [v, v])),
      },
    },
    outDir: "lib",
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "main",
      fileName: "main",
      formats: ["umd", "es", "cjs", "iife", "amd"],
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
