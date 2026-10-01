// Diagnóstico somente: carrega os módulos de produção da versão commitada,
// sem restaurar ou alterar os arquivos em edição.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';
const raiz=fileURLToPath(new URL('../',import.meta.url));
export async function load(url,context,nextLoad) {
 if(url.startsWith('file:')) {
  const path=relative(raiz,fileURLToPath(url)).replaceAll('\\','/');
  if(path.startsWith('src/') && path.endsWith('.js')) {
   try {return {format:'module',shortCircuit:true,source:execFileSync('git',['show','HEAD:'+path],{cwd:raiz,encoding:'utf8',stdio:['ignore','pipe','ignore']})};} catch {}
  }
 }
 return nextLoad(url,context);
}
