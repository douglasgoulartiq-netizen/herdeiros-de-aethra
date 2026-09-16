// Onde mora a arte de cada item.
//
// POR QUE ISTO EXISTE
// -------------------
// Oito lugares da interface montavam o caminho do ícone à mão, sempre assim:
//
//     <img src="assets/icons/${item.icone}.png">
//
// `icone` tem vinte valores para 287 itens, então toda espada do jogo — da
// enferrujada à lendária — apontava para o MESMO arquivo. E, pior, esse
// arquivo não existia: a pasta assets/icons/ nunca foi criada, os vinte
// pedidos davam 404 e o jogo desenhava a mesma caixinha marrom de placeholder
// para arma, poção, minério e anel.
//
// Agora cada item tem o próprio ícone, gerado por scripts/gerar-icones.py com
// FORMA vinda do subtipo e COR vinda do material lido do nome. O índice
// id -> chave é produzido pelo mesmo script (src/data/itemIcons.json), para a
// tabela de materiais existir num lugar só: reimplementá-la aqui em
// JavaScript seria manter a mesma regra em duas linguagens, e a segunda cópia
// envelheceria na primeira vez que alguém acrescentasse um item.
//
// A cadeia de fallback tem três degraus e nunca termina em nada:
//
//   1. o ícone específico do item (o caso normal);
//   2. o ícone antigo de vinte nomes, que o gerador também emite — cobre um
//      item novo posto em items.json antes de rodar o gerador;
//   3. o placeholder do loader, que já existia.

let INDICE = {};

// Chamado pelo loader assim que itemIcons.json chega.
export function definirIndiceDeIcones(indice) {
  INDICE = indice && typeof indice === "object" ? indice : {};
}

// Chave do ícone deste item: "espada__elfico", "pocao__sangue"... Cai no
// campo `icone` antigo quando o item não está no índice.
export function chaveDoIcone(item) {
  if (!item) return "gema";
  return INDICE[item.id] || item.icone || "gema";
}

// Caminho do arquivo, que é o que a interface precisa.
export function caminhoDoIcone(item) {
  return `assets/icons/${chaveDoIcone(item)}.png`;
}

// Chave do cache de imagens do loader (`imagens[...]`), para quem desenha no
// canvas em vez de usar <img>.
export function chaveDeCacheDoIcone(item) {
  return `icon_${chaveDoIcone(item)}`;
}

// Todas as chaves que precisam ser carregadas — o loader usa para montar a
// lista de imagens sem repetir arquivo.
export function chavesDeIconeEmUso(itens) {
  const set = new Set();
  for (const item of itens || []) set.add(chaveDoIcone(item));
  // Os vinte nomes antigos entram sempre: são a rede de segurança do degrau 2.
  for (const item of itens || []) if (item.icone) set.add(item.icone);
  return [...set];
}
