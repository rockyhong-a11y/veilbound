import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await mkdir('dist', { recursive:true });
for (const file of ['index.html','style.css','game.js','engine.js','arsenal.js','world.js','favicon.svg']) await copyFile(file, `dist/${file}`);
await rm('dist/assets', { recursive:true, force:true });
await cp('assets', 'dist/assets', { recursive:true, filter: path => !/\.blend\d*$/.test(path) && !path.includes('/frames') });
console.log('Built VEILBOUND → dist');
