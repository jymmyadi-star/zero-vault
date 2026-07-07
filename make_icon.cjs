const fs = require('fs');
const { execSync } = require('child_process');

const svgPath = 'd:/Zero Vault full/bird-app-icon.svg';
let svgContent = fs.readFileSync(svgPath, 'utf8');

// 1. Remove original background
svgContent = svgContent.replace(/<rect x="0" y="0" width="1024" height="1024" rx="225" fill="#f6f5f2"\/>/g, '');

// 2. Add black background and red aura
const backgroundAndAura = `
  <rect width="1024" height="1024" fill="#000000"/>
  <circle cx="512" cy="512" r="280" fill="#FF0033" opacity="0.15" />
`;
// Replace the original transform with the fixed transform
svgContent = svgContent.replace('<g transform="translate(-410.62,-280.09) scale(1.3223)">', backgroundAndAura + '<g transform="translate(-509.62,-160.09) scale(1.3223)">');

// 3. Change bird body to white
svgContent = svgContent.replace('<g fill="#0a0a0a" stroke="none">', '<g fill="#F4F4F5" stroke="none">');

// 4. Change internal lines to black
svgContent = svgContent.replace('stroke="#ffffff" stroke-width="1.1" opacity="0.55"', 'stroke="#000000" stroke-width="1.1" opacity="0.4"');

// 5. Add the head inside the white bird group
const headPath = `
    <!-- Smooth Organic Head & Beak -->
    <path d="M 669.17,326.76 C 655,300 645,270 650,245 C 654,222 668,203 692,193 C 716,183 740,190 752,208 C 764,224 764,244 754,258 C 748,266 740,270 733,272 C 720,275 700,272 685,268 C 660,262 630,268 600,282 C 585,289 578,292 580,285 C 590,258 615,232 640,222 C 645,220 648,222 646,227 C 636,248 632,272 638,295 C 642,310 650,322 660,330 Z" fill="#F4F4F5" />
`;
svgContent = svgContent.replace('</g>\n<g clip-path="url(#bodyClip)"', headPath + '\n</g>\n<g clip-path="url(#bodyClip)"');

// Write out the new SVG
fs.writeFileSync('assets/icon.svg', svgContent);
console.log('Created assets/icon.svg');

// Export to PNG
console.log('Converting to PNG...');
try {
  execSync('npx -y svgexport assets/icon.svg assets/icon.png 1024:1024', { stdio: 'inherit' });
  console.log('Successfully generated assets/icon.png');
} catch (e) {
  console.error('Failed to convert SVG to PNG:', e.message);
}
