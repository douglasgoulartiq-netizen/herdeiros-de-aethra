// Conversão sem perdas: dimensões e pixels RGBA visíveis permanecem idênticos.
// Recebe opcionalmente o caminho para a dependência sharp já instalada.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const dir = path.resolve('assets/arte_v3');
const files = (await fs.readdir(dir)).filter(f=>f.endsWith('.png'));
let before=0, after=0;
for(const name of files){
  const input=path.join(dir,name),output=input.replace(/\.png$/,'.webp');
  await sharp(input).webp({lossless:true,effort:5}).toFile(output);
  const a=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(a.info.width!==b.info.width||a.info.height!==b.info.height) throw new Error(`Dimensão alterada: ${name}`);
  // RGB invisível sob alfa zero pode ser normalizado pelo codec.
  for(let i=0;i<a.data.length;i+=4){
    if(a.data[i+3]!==b.data[i+3] || (a.data[i+3]>0 && (a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]))) throw new Error(`Pixel visível alterado: ${name}`);
  }
  before+=(await fs.stat(input)).size;after+=(await fs.stat(output)).size;
}
console.log(JSON.stringify({files:files.length,before,after,savedPercent:Math.round((1-after/before)*100)}));
