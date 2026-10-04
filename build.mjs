import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await mkdir('dist', { recursive:true });
for (const file of ['index.html','style.css','game.js','engine.js','arsenal.js','world.js','scenery.js','sprites.js','favicon.svg']) await copyFile(file, `dist/${file}`);
await rm('dist/assets', { recursive:true, force:true });
await mkdir('dist/assets', { recursive:true });
// Publish the active web art. Historical Blender sources remain in the repository.
for (const file of ['cover.png','reliquary-chest.png','reliquary-portal.png','reliquary-animations.json', ...['sword','gauntlet','spear','gun','bow','harpoon','greatsword','scythe'].map(type => `arsenal-icon-${type}.png`)]) await copyFile(`assets/${file}`, `dist/assets/${file}`);
await cp('assets/remake', 'dist/assets/remake', { recursive:true });
console.log('Built VEILBOUND → dist');
