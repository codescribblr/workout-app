import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const svgPath = join(process.cwd(), 'public', 'icon.svg');
const publicDir = join(process.cwd(), 'public');

async function generateIcons() {
  const svgBuffer = readFileSync(svgPath);

  // Generate 192x192 icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, 'icon-192x192.png'));

  // Generate 512x512 icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'icon-512x512.png'));

  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
