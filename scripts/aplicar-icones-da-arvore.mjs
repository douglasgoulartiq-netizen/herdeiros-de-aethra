// UM ÍCONE PARA CADA NÓ DA ÁRVORE DE HABILIDADES.
//
// POR QUE
// -------
// A tela nova da árvore mostra cada talento como um LADRILHO: ícone grande,
// nome curto embaixo. Isso só funciona se todo nó tiver ícone — e 53 dos 108
// não tinham (as passivas e as marcas herdavam o ícone do que concedem, mas
// nó de habilidade ativa e nó de atributo não carregam nenhum).
//
// A tabela abaixo é explícita, nó por nó, e não derivada do tipo: um ícone
// escolhido por regra ("toda ativa é ⚔️") faria seis ladrilhos idênticos na
// mesma coluna, que é exatamente o que a tela de ladrilhos precisa evitar.
//
// Idempotente. Onde o nó JÁ traz um ícone próprio, este script não mexe.
//
// Uso:  node scripts/aplicar-icones-da-arvore.mjs            (simulação)
//       node scripts/aplicar-icones-da-arvore.mjs --escrever
import fs from "node:fs";

const CAMINHO = new URL("../src/data/skillTrees.json", import.meta.url);

export const ICONES = {
  // --- GUERREIRO ---
  guerreiro_lamina_1: "🗡️", guerreiro_lamina_2: "🥊", guerreiro_lamina_3: "💥",
  guerreiro_lamina_4: "💪", guerreiro_lamina_5: "🪓", guerreiro_lamina_6: "⚔️",
  guerreiro_baluarte_1: "🗿", guerreiro_baluarte_2: "🧍", guerreiro_baluarte_3: "🪖",
  guerreiro_baluarte_4: "❤️", guerreiro_baluarte_5: "🛡️", guerreiro_baluarte_6: "🏰",
  guerreiro_comando_1: "📣", guerreiro_comando_2: "📐", guerreiro_comando_3: "🧱",
  guerreiro_comando_4: "🏃", guerreiro_comando_5: "🚩", guerreiro_comando_6: "🎖️",
  // --- MAGO ---
  mago_elementalista_1: "❄️", mago_elementalista_2: "⚡", mago_elementalista_3: "🔌",
  mago_elementalista_4: "🔵", mago_elementalista_5: "🌟", mago_elementalista_6: "🔮",
  mago_arcanista_1: "💧", mago_arcanista_2: "🎯", mago_arcanista_3: "🧠",
  mago_arcanista_4: "🔭", mago_arcanista_5: "☄️", mago_arcanista_6: "🧿",
  mago_runas_1: "🐌", mago_runas_2: "👣", mago_runas_3: "🪨",
  mago_runas_4: "🪧", mago_runas_5: "🩸", mago_runas_6: "🪬",
  // --- LADINO ---
  ladino_sombra_1: "🗡️", ladino_sombra_2: "👁️", ladino_sombra_3: "✋",
  ladino_sombra_4: "☠️", ladino_sombra_5: "🧊", ladino_sombra_6: "🩸",
  ladino_gemeas_1: "🌀", ladino_gemeas_2: "⚔️", ladino_gemeas_3: "🤸",
  ladino_gemeas_4: "🧪", ladino_gemeas_5: "🌪️", ladino_gemeas_6: "🎼",
  ladino_trapaca_1: "💨", ladino_trapaca_2: "🎭", ladino_trapaca_3: "💰",
  ladino_trapaca_4: "📍", ladino_trapaca_5: "📖", ladino_trapaca_6: "🎲",
  // --- CLÉRIGO ---
  clerigo_luz_1: "🌅", clerigo_luz_2: "🤲", clerigo_luz_3: "🙏",
  clerigo_luz_4: "☀️", clerigo_luz_5: "🕊️", clerigo_luz_6: "✨",
  clerigo_fe_marcial_1: "🛡️", clerigo_fe_marcial_2: "🎵", clerigo_fe_marcial_3: "💗",
  clerigo_fe_marcial_4: "📿", clerigo_fe_marcial_5: "🌐", clerigo_fe_marcial_6: "🛐",
  clerigo_punicao_1: "🔨", clerigo_punicao_2: "👟", clerigo_punicao_3: "⚖️",
  clerigo_punicao_4: "📜", clerigo_punicao_5: "🔥", clerigo_punicao_6: "⚡",
  // --- BÁRBARO ---
  barbaro_furia_1: "🪓", barbaro_furia_2: "🩸", barbaro_furia_3: "💪",
  barbaro_furia_4: "😡", barbaro_furia_5: "💢", barbaro_furia_6: "🔥",
  barbaro_instinto_1: "🗿", barbaro_instinto_2: "🦁", barbaro_instinto_3: "🌿",
  barbaro_instinto_4: "🪵", barbaro_instinto_5: "🫁", barbaro_instinto_6: "🐺",
  barbaro_devastacao_1: "🌀", barbaro_devastacao_2: "⚡", barbaro_devastacao_3: "👣",
  barbaro_devastacao_4: "🌋", barbaro_devastacao_5: "☠️", barbaro_devastacao_6: "🌪️",
  // --- PATRULHEIRO ---
  patrulheiro_cacada_1: "🏹", patrulheiro_cacada_2: "🦅", patrulheiro_cacada_3: "🎯",
  patrulheiro_cacada_4: "📍", patrulheiro_cacada_5: "➶", patrulheiro_cacada_6: "🩸",
  patrulheiro_tempestade_1: "🌧️", patrulheiro_tempestade_2: "🎒", patrulheiro_tempestade_3: "⚡",
  patrulheiro_tempestade_4: "🔥", patrulheiro_tempestade_5: "💫", patrulheiro_tempestade_6: "🌩️",
  patrulheiro_vinculo_1: "🐾", patrulheiro_vinculo_2: "🌱", patrulheiro_vinculo_3: "🌿",
  patrulheiro_vinculo_4: "🐺", patrulheiro_vinculo_5: "🍖", patrulheiro_vinculo_6: "🌳",
};

const dados = JSON.parse(fs.readFileSync(CAMINHO, "utf8"));
let postos = 0; let mantidos = 0; const semTabela = [];

for (const arvore of Object.values(dados)) {
  for (const no of arvore.nos) {
    if (no.icone) { mantidos += 1; continue; }
    const ic = ICONES[no.id];
    if (!ic) { semTabela.push(no.id); continue; }
    // O ícone entra como PRIMEIRO campo depois do id, para o JSON continuar
    // legível: quem abre o arquivo vê id, ícone e nome juntos.
    const copia = { ...no };
    for (const k of Object.keys(no)) delete no[k];
    no.id = copia.id; no.icone = ic;
    for (const [k, v] of Object.entries(copia)) if (k !== "id") no[k] = v;
    postos += 1;
  }
}

if (semTabela.length) {
  console.error(`nó sem ícone na tabela: ${semTabela.join(", ")}`);
  process.exitCode = 1;
}

if (process.argv.includes("--escrever")) {
  fs.writeFileSync(CAMINHO, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  console.log(`gravado: ${postos} ícones postos, ${mantidos} nós já tinham o próprio`);
} else {
  console.log(`(simulação — use --escrever) ${postos} ícones seriam postos, ${mantidos} nós já têm o próprio`);
}
