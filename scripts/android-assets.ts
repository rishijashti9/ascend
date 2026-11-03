/**
 * Renders the Android launcher-icon and splash source images from the app's SVG symbol,
 * then lets @capacitor/assets produce every Android size.
 *
 *   npm run icons:android
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const BG = '#0E1116';
const OUT = 'assets';

/** The ASCEND symbol (chevron + horizon) on a 512 grid, optionally scaled about the centre. */
function symbol(scale: number): string {
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  return `<g transform="${t}">
    <path d="M148 292 256 184 364 292" fill="none" stroke="#4C8DFF" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M184 364h144" fill="none" stroke="#E6EDF3" stroke-opacity="0.4" stroke-width="28" stroke-linecap="round"/>
  </g>`;
}

function svg(size: number, body: string, background: string | null): Buffer {
  const bg = background ? `<rect width="512" height="512" fill="${background}"/>` : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${bg}${body}</svg>`,
  );
}

async function render(file: string, size: number, body: string, background: string | null) {
  await sharp(svg(size, body, background))
    .png()
    .toFile(`${OUT}/${file}`);
  console.log(`  ${OUT}/${file}`);
}

mkdirSync(OUT, { recursive: true });
console.log('Rendering source images:');
// Legacy icon: full symbol on the dark square.
await render('icon-only.png', 1024, symbol(1), BG);
// Adaptive icon: Capacitor's XML insets the foreground 16.7%, which keeps it in the safe zone.
await render('icon-foreground.png', 1024, symbol(1), null);
await render('icon-background.png', 1024, '', BG);
// Splash: small symbol centred on the dark background (same in light and dark mode).
await render('splash.png', 2732, symbol(0.22), BG);
await render('splash-dark.png', 2732, symbol(0.22), BG);

console.log('Generating Android sizes:');
execSync(
  `npx capacitor-assets generate --android --iconBackgroundColor "${BG}" --iconBackgroundColorDark "${BG}" --splashBackgroundColor "${BG}" --splashBackgroundColorDark "${BG}"`,
  { stdio: 'inherit' },
);

// capacitor-assets writes a white fallback colour; keep it dark like the icon.
const colorFile = 'android/app/src/main/res/values/ic_launcher_background.xml';
writeFileSync(colorFile, readFileSync(colorFile, 'utf8').replace(/#[0-9A-Fa-f]{6}/, BG));
console.log(`  ${colorFile} → ${BG}`);

// capacitor-assets rewrites the adaptive-icon XML; put back the monochrome layer that
// themed icons (Android 13+, e.g. Nothing OS) use — drawable/ic_ascend_symbol.xml (task 10.4).
const MONO = `    <monochrome>
        <inset android:drawable="@drawable/ic_ascend_symbol" android:inset="0%" />
    </monochrome>
</adaptive-icon>`;
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  const file = `android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`;
  const xml = readFileSync(file, 'utf8');
  if (!xml.includes('<monochrome>')) writeFileSync(file, xml.replace('</adaptive-icon>', MONO));
  console.log(`  ${file} → monochrome layer`);
}
