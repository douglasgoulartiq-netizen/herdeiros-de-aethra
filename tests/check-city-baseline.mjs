// Diagnóstico sem checkout/reset: executa a suíte de NPCs com o gerador
// versionado no HEAD, em memória, preservando todas as mudanças locais.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const worldURL=new URL('src/systems/WorldBuilder.js',root);
const absolute=(source,base)=>source.replace(/(["'])(\.\.?\/[^"']+)\1/g,(_,q,path)=>q+new URL(path,base).href+q);
const previous=absolute(execFileSync('git',['show','HEAD:src/systems/WorldBuilder.js'],{cwd:root,encoding:'utf8'}),worldURL);
const moduleURL='data:text/javascript;base64,'+Buffer.from(previous).toString('base64');
const testURL=new URL('scripts/test-npcs-etapa3.mjs',root);
let test=absolute(readFileSync(testURL,'utf8'),testURL);
test=test.replaceAll(worldURL.href,moduleURL).replaceAll('import.meta.url',JSON.stringify(testURL.href));
await import('data:text/javascript;base64,'+Buffer.from(test).toString('base64'));
