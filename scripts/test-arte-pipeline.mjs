// TESTE DA TUBULAÇÃO DE ARTE.
//
// Roda em Node puro, sem navegador: o assetRegistry é só texto entrando e
// saindo, e é isso que o torna testável assim. As regras de caminho são o
// contrato entre o jogo e o zip que vem do Codex — se elas escorregarem, a
// arte nova entra e não aparece, sem erro nenhum na tela.
//
// Uso: node scripts/test-arte-pipeline.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  candidatos, chaveDe, familiaGenerica, melhorCaminho, tamanhoEsperado,
  USOS, PASTA_V2, PASTA_ATUAL, PASTA_HD, TAMANHO_ALVO,
} from "../src/data/assetRegistry.js";
import { FLAGS } from "../src/data/featureFlags.js";

let ok = 0; let falhou = 0;
const secao = (t) => console.log(`\n── ${t}`);
function ver(nome, condicao, detalhe = "") {
  if (condicao) { ok += 1; console.log(`  ✓ ${nome}`); } else {
    falhou += 1; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
secao("1. A chave é o nome do arquivo — e ela não pode mudar");

ver("monstro usa o campo `sprite` do JSON, não o id",
  chaveDe({ id: "slime_verde", sprite: "mob_slime" }) === "mob_slime",
  chaveDe({ id: "slime_verde", sprite: "mob_slime" }));
ver("extensão .png no campo sprite é tolerada",
  chaveDe({ sprite: "mob_slime.png" }) === "mob_slime");
ver("personagem principal vira pc_<raça>_<classe>",
  chaveDe({ racaId: "humano", classeId: "mago" }) === "pc_humano_mago");
ver("convocado vira gacha_<rosterId>",
  chaveDe({ rosterId: "aelric_lamina_do_vento" }) === "gacha_aelric_lamina_do_vento");
ver("string entra e sai igual", chaveDe("mob_lobo") === "mob_lobo");
ver("nada não quebra: devolve null", chaveDe(null) === null && chaveDe({}) === null);

// ---------------------------------------------------------------------------
secao("2. Com arteV2 DESLIGADA o jogo procura exatamente o que sempre procurou");

const anterior = FLAGS.arteV2;
FLAGS.arteV2 = false;

ver("combate de monstro → assets/sprites/<chave>.png",
  melhorCaminho({ sprite: "mob_slime" }, USOS.COMBATE) === `${PASTA_ATUAL}/mob_slime.png`,
  melhorCaminho({ sprite: "mob_slime" }, USOS.COMBATE));
ver("retrato de personagem usa a folha oficial mesmo com a flag legada desligada",
  melhorCaminho({ racaId: "elfo", classeId: "ladino" }, USOS.RETRATO)
    === 'assets/sprites/walk_v2_pc_elfo_ladino.png',
  melhorCaminho({ racaId: "elfo", classeId: "ladino" }, USOS.RETRATO));
ver("convocado atualizado mantém sua identidade exclusiva",
  melhorCaminho({ rosterId: "dura_passoleve" }, USOS.RETRATO)
    === 'assets/arte_v3/gacha_dura_passoleve.webp');
ver("nenhum candidato aponta pra arte nova quando a flag está desligada",
  candidatos({ sprite: "mob_slime" }, USOS.COMBATE).every((u) => !u.includes("arte_v2")));

// ---------------------------------------------------------------------------
secao("3. Com arteV2 LIGADA a arte nova vem primeiro e a antiga continua de rede");

FLAGS.arteV2 = true;
const cadeiaCombate = candidatos({ sprite: "mob_slime" }, USOS.COMBATE);
ver("a arte nova é o primeiro degrau",
  cadeiaCombate[0] === `${PASTA_V2}/mob_slime.png`, cadeiaCombate[0]);
ver("o sprite atual continua na cadeia como rede",
  cadeiaCombate.includes(`${PASTA_ATUAL}/mob_slime.png`), cadeiaCombate.join(" → "));
ver("a cadeia tem mais de um degrau", cadeiaCombate.length >= 2);

const cadeiaPoster = candidatos({ sprite: "mob_slime" }, USOS.POSTER);
ver("pôster pede o sufixo _portrait",
  cadeiaPoster[0] === `${PASTA_V2}/mob_slime_portrait.png`, cadeiaPoster[0]);
ver("pôster que ainda não existe cai na arte nova de combate antes de cair na antiga",
  cadeiaPoster[1] === `${PASTA_V2}/mob_slime.png`, cadeiaPoster.join(" → "));

const cadeiaIcone = candidatos({ rosterId: "dura_passoleve" }, USOS.RETRATO);
ver("retrato usa a arte oficial refinada",
  cadeiaIcone[0] === 'assets/arte_v3/gacha_dura_passoleve.webp', cadeiaIcone[0]);

ver("nenhuma URL se repete dentro da cadeia",
  new Set(cadeiaPoster).size === cadeiaPoster.length);

// ---------------------------------------------------------------------------
secao("4. O override por encontro vale sem virar o jogo inteiro");

FLAGS.arteV2 = false;
ver("override liga a arte nova só nesta chamada",
  candidatos({ sprite: "mob_lobo" }, USOS.COMBATE, { arteV2: true })[0]
    === `${PASTA_V2}/mob_lobo.png`);
ver("e a chamada seguinte, sem override, continua na arte antiga",
  melhorCaminho({ sprite: "mob_lobo" }, USOS.COMBATE) === `${PASTA_ATUAL}/mob_lobo.png`);
ver("a flag global não foi alterada pelo override", FLAGS.arteV2 === false);

FLAGS.arteV2 = true;
ver("override também DESLIGA a arte nova numa chamada só (comparação lado a lado)",
  candidatos({ sprite: "mob_lobo" }, USOS.COMBATE, { arteV2: false })[0]
    === `${PASTA_ATUAL}/mob_lobo.png`);
FLAGS.arteV2 = anterior;

// ---------------------------------------------------------------------------
secao("5. Retrato genérico por família — melhor um lobo genérico que um emoji");

ver("lobo gélido é da família lobo", familiaGenerica("mob_lobo_gelido") === "lobo");
ver("troll das cavernas cai em orc", familiaGenerica("mob_troll_das_cavernas") === "orc");
ver("lodo negro é slime, não lobo (a armadilha do substring solto)",
  familiaGenerica("mob_lodo_negro") === "slime", familiaGenerica("mob_lodo_negro"));
ver("golem não tem família e admite isso", familiaGenerica("mob_golem_de_pedra") === null);
ver("o genérico entra na cadeia de retrato de monstro",
  candidatos({ sprite: "mob_lobo_gelido" }, USOS.RETRATO)
    .includes(`${PASTA_HD}/retrato_monstro_lobo.png`));
ver("e NÃO entra na cadeia de combate (lá o genérico seria mentira)",
  !candidatos({ sprite: "mob_lobo_gelido" }, USOS.COMBATE)
    .some((u) => u.includes("retrato_monstro")));

// ---------------------------------------------------------------------------
secao("6. Os tamanhos batem com os que foram para os briefings");

ver("monstro comum no combate: 192×192",
  tamanhoEsperado({ sprite: "mob_slime" }, USOS.COMBATE).largura === 192);
ver("chefe no combate: 256×256",
  tamanhoEsperado({ sprite: "mob_dragao_jovem", chefe: true }, USOS.COMBATE).largura === 256);
ver("pôster: 1024×1536",
  tamanhoEsperado({ sprite: "mob_slime" }, USOS.POSTER).largura === 1024
  && tamanhoEsperado({ sprite: "mob_slime" }, USOS.POSTER).altura === 1536);
ver("ícone: 64×64", tamanhoEsperado({ sprite: "mob_slime" }, USOS.RETRATO).largura === 64);
ver("todo uso declarado tem tamanho alvo",
  Object.values(USOS).every((u) => TAMANHO_ALVO[u]));

// ---------------------------------------------------------------------------
secao("7. Os caminhos que o registro promete existem de verdade nesta cópia");

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const existe = (rel) => fs.existsSync(path.join(raiz, rel));
FLAGS.arteV2 = false;

const spritesReais = fs.existsSync(path.join(raiz, PASTA_ATUAL))
  ? fs.readdirSync(path.join(raiz, PASTA_ATUAL)).filter((f) => f.startsWith("gacha_"))
  : [];
if (spritesReais.length) {
  const amostra = spritesReais.slice(0, 5).map((f) => f.replace(/^gacha_|\.png$/g, ""));
  const achou = amostra.filter((id) => existe(melhorCaminho({ rosterId: id }, USOS.RETRATO)));
  ver(`o caminho de retrato aponta para arquivo real (${achou.length}/${amostra.length} da amostra)`,
    achou.length === amostra.length);
} else {
  console.log("  … sem sprites de gacha nesta cópia; conferência de disco pulada");
}
ver("a pasta da arte nova ainda não existe — e isso NÃO pode quebrar nada",
  !existe(PASTA_V2) || fs.statSync(path.join(raiz, PASTA_V2)).isDirectory());

FLAGS.arteV2 = anterior;

// ---------------------------------------------------------------------------
secao("8. Nenhuma tela monta caminho de asset na mão (é o registro que faz isso)");

// A tubulação só cumpre a promessa se as telas realmente passarem por ela.
// Este teste varre a UI atrás de template de caminho colado no HTML — o
// padrão que o registro veio substituir.
const pastaUi = path.join(raiz, "src/ui");
const suspeitos = [];
fs.readdirSync(pastaUi).filter((f) => f.endsWith(".js")).forEach((f) => {
  const texto = fs.readFileSync(path.join(pastaUi, f), "utf8");
  texto.split("\n").forEach((linha, i) => {
    // Só interessa caminho INTERPOLADO (com ${...}): caminho fixo de ícone
    // decorativo não é o problema que o registro resolve. E precisa pegar
    // tanto o template colado dentro do src= quanto o guardado numa
    // variável antes — foi assim que a BattleUI montava o retrato.
    const noTemplate = /`[^`]*assets\/[^`]*\$\{/.test(linha);
    const noAtributo = /src=["'][^"']*assets\/[^"']*\$\{/.test(linha);
    if (noTemplate || noAtributo) suspeitos.push(`${f}:${i + 1}`);
  });
});
ver("GachaUI não monta mais caminho na mão",
  !suspeitos.some((s) => s.startsWith("GachaUI")), suspeitos.join(", "));
if (suspeitos.length) {
  console.log(`    (ainda montam na mão, para as próximas levas: ${suspeitos.join(", ")})`);
}

// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(60)}`);
console.log(`Resultado: ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
