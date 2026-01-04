import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const iconsDir = path.join(publicDir, 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create SVG icons at different sizes (browsers will scale them)
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#818cf8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="url(#grad)"/>
  <circle cx="50" cy="50" r="30" fill="#0a0a0f"/>
  <circle cx="50" cy="50" r="8" fill="url(#grad)"/>
  <rect x="48" y="20" width="4" height="15" fill="#0a0a0f" rx="2"/>
</svg>`;

// Generate SVG icons
sizes.forEach(size => {
  const svgPath = path.join(iconsDir, `icon-${size}.svg`);
  fs.writeFileSync(svgPath, svgTemplate(size));
  console.log(`Generated ${svgPath}`);
});

// Also create apple-touch-icon
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png.svg'), svgTemplate(180));
console.log('Generated apple-touch-icon.png.svg');

console.log('Icon generation complete!');
