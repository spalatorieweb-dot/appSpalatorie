import { defineConfig } from 'vite';

// base relativ: merge pe https://<user>.github.io/<orice-nume-de-repo>/
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
