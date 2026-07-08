import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const distDir = resolve(__dirname, 'dist');

// Ensure dist directories
for (const dir of ['dist', 'dist/background', 'dist/content', 'dist/popup', 'dist/icons']) {
  const path = resolve(__dirname, dir);
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

const entryPoints = {
  'background/service-worker': 'background/service-worker.ts',
  'content/autofill': 'content/autofill.ts',
  'popup/popup': 'popup/popup.ts',
};

import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '../.env') });

const ctx = await esbuild.context({
  entryPoints,
  outdir: distDir,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: watch,
  minify: true,
  treeShaking: true,
  alias: { buffer: 'buffer/' },
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''),
    'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_URL || ''),
    'process.env.EXPO_PUBLIC_ZEROVAULT_API_URL': JSON.stringify(process.env.EXPO_PUBLIC_ZEROVAULT_API_URL || ''),
  },
});

// Copy static files
function copyStatic() {
  // manifest
  copyFileSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));

  // popup HTML
  const html = readFileSync(resolve(__dirname, 'popup/index.html'), 'utf-8');
  writeFileSync(resolve(distDir, 'popup/index.html'), html);

  // icons (generate placeholder SVGs as PNG-insufficient)
  for (const size of [16, 48, 128]) {
    const iconPath = resolve(__dirname, 'icons', `icon${size}.png`);
    if (!existsSync(iconPath)) {
      // Create a minimal SVG-based icon placeholder
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size/4}" fill="#0a0a0f"/><text x="${size/2}" y="${size/2+4}" text-anchor="middle" fill="#00F0FF" font-size="${size/2}" font-family="monospace" font-weight="bold">Z</text></svg>`;
      const dstSvg = resolve(distDir, 'icons', `icon${size}.svg`);
      writeFileSync(dstSvg, svg);
    } else {
      copyFileSync(iconPath, resolve(distDir, 'icons', `icon${size}.png`));
    }
  }
}

copyStatic();

if (watch) {
  await ctx.watch();
  console.log('[build] Watching for changes...');
  // Watch static files too by rebuilding on changes
  setInterval(copyStatic, 2000);
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('[build] Complete — dist/ is ready. Load as unpacked extension in Chrome.');
  console.log('  chrome://extensions → Developer mode ON → Load unpacked → select dist/');
}
