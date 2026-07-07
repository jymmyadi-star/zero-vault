const fs = require('fs');
const src = 'C:/Users/Andrei/.gemini/antigravity/brain/0b49e0fd-677c-4c66-9aa5-cc7493957716/purple_liquid_glass_bg_1783094786632.png';
const dest = './assets/images/liquid_glass_bg.png';
fs.copyFileSync(src, dest);
console.log('Copied successfully!');
