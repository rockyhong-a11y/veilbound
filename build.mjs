import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive:true });
for (const file of ['index.html','style.css','game.js','engine.js','world.js','favicon.svg']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive:true, filter: path => !path.endsWith('.blend') && !path.includes('/frames') });
console.log('Built VEILBOUND → dist');
