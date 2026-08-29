// Tela de criação de personagem em etapas (nome, raça, classe, antecedente, traço, resumo).
import { criarPersonagem } from "../systems/CharacterFactory.js";
import { infoAfinidade } from "../systems/AffinitySystem.js";

const ETAPAS = ["nome", "raca", "classe", "antecedente", "traco", "resumo"];

export function montarCriacaoPersonagem(container, dados, onFinalizar) {
  const estado = { nome: "", raca: null, classe: null, antecedente: null, traco: null, etapaIdx: 0, modoHistoria: false };

  function render() {
    const etapa = ETAPAS[estado.etapaIdx];
    container.innerHTML = "";
    const painel = document.createElement("div");
    painel.className = "painel-criacao";

    const titulo = document.createElement("h2");
    titulo.className = "passo-titulo";
    painel.appendChild(titulo);
    container.appendChild(painel);

    if (etapa === "nome") {
      titulo.textContent = "Como se chama seu herói?";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Digite um nome...";
      input.value = estado.nome;
      input.style.cssText = "font-size:1.1em;padding:10px;width:280px;border-radius:4px;border:2px solid #7a5c34;background:#241b14;color:#f1e9d8;";
      painel.appendChild(input);
      painel.appendChild(document.createElement("br"));
      const btn = document.createElement("button");
      btn.className = "primario";
      btn.textContent = "Avançar";
      btn.style.marginTop = "16px";
      btn.onclick = () => {
        estado.nome = input.value.trim() || "Aventureiro";
        estado.etapaIdx++;
        render();
      };
      painel.appendChild(btn);
    } else if (etapa === "raca") {
      titulo.textContent = "Escolha sua Raça";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.races.forEach((r) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.raca === r.id ? " selecionada" : "");
        const bonusTxt = Object.entries(r.bonus).map(([k, v]) => `+${v} ${k}`).join(", ");
        card.innerHTML = `<h3>${r.nome}</h3><p>${r.descricao}</p><p><b>${bonusTxt}</b></p><p>${r.descricaoTraco}</p>`;
        card.onclick = () => { estado.raca = r.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.raca);
    } else if (etapa === "classe") {
      titulo.textContent = "Escolha sua Classe";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.classes.forEach((c) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.classe === c.id ? " selecionada" : "");
        const habsHTML = c.habilidades.map((h) => `<div class="habilidade-inicial"><b>${h.nome}</b> — ${h.descricao}</div>`).join("");
        // Afinidade racial de classe (task #41): mostra se a raça já
        // escolhida na etapa anterior tem afinidade com esta classe —
        // decisão informada, nunca uma restrição (todas as classes
        // continuam disponíveis pra qualquer raça).
        const afinidade = infoAfinidade(estado.raca, c.id, dados.affinities);
        card.innerHTML = `
          <h3>${c.icone || ""} ${c.nome}</h3>
          <p>${c.descricao || ""}</p>
          <p>Vida base: ${c.vidaBase} | Mana base: ${c.manaBase}</p>
          ${afinidade ? `<p class="badge-afinidade" title="${afinidade.texto}">🔗 Afinidade com sua raça!</p>` : ""}
          <div class="habilidades-iniciais-lista">${habsHTML}</div>
        `;
        card.onclick = () => { estado.classe = c.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.classe);
    } else if (etapa === "antecedente") {
      titulo.textContent = "Escolha seu Antecedente";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.backgrounds.forEach((b) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.antecedente === b.id ? " selecionada" : "");
        card.innerHTML = `<h3>${b.nome}</h3><p>${b.descricao}</p><p>Perícia: ${b.pericia}</p><p>Início: ${b.ouroInicial} ouro</p>`;
        card.onclick = () => { estado.antecedente = b.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.antecedente);
    } else if (etapa === "traco") {
      titulo.textContent = "Escolha um Traço de Personalidade";
      const grid = document.createElement("div");
      grid.className = "grid-opcoes";
      dados.traits.forEach((t) => {
        const card = document.createElement("div");
        card.className = "opcao-card" + (estado.traco === t.id ? " selecionada" : "");
        card.innerHTML = `<h3>${t.nome}</h3><p>${t.descricao}</p>`;
        card.onclick = () => { estado.traco = t.id; render(); };
        grid.appendChild(card);
      });
      painel.appendChild(grid);
      adicionarNavegacao(painel, estado, render, () => estado.traco);
    } else if (etapa === "resumo") {
      titulo.textContent = `Resumo de ${estado.nome}`;
      const personagem = criarPersonagem(estado, dados);
      personagem.modoHistoria = estado.modoHistoria;
      const afinidadeResumo = infoAfinidade(estado.raca, estado.classe, dados.affinities);
      const resumo = document.createElement("div");
      resumo.innerHTML = `
        <p>${dados.classes.find((c) => c.id === estado.classe).icone || ""} ${dados.races.find((r) => r.id === estado.raca).nome} ${dados.classes.find((c) => c.id === estado.classe).nome},
        antecedente ${dados.backgrounds.find((b) => b.id === estado.antecedente).nome}.</p>
        ${afinidadeResumo ? `<p class="badge-afinidade">🔗 ${afinidadeResumo.texto}</p>` : ""}
        <div class="stat-row"><span>Força</span><span>${personagem.atributos.FOR}</span></div>
        <div class="stat-row"><span>Destreza</span><span>${personagem.atributos.DES}</span></div>
        <div class="stat-row"><span>Constituição</span><span>${personagem.atributos.CON}</span></div>
        <div class="stat-row"><span>Inteligência</span><span>${personagem.atributos.INT}</span></div>
        <div class="stat-row"><span>HP máximo</span><span>${personagem.hpMax}</span></div>
        <div class="stat-row"><span>MP máximo</span><span>${personagem.mpMax}</span></div>
        <div class="stat-row"><span>Ouro inicial</span><span>${personagem.ouro}</span></div>
        <p><i>${personagem.descricaoTraco}</i></p>
      `;
      painel.appendChild(resumo);
      // Modo História (melhoria pós-backlog): opção de dificuldade mais
      // leve, oferecida uma única vez aqui no resumo final — reduz hp/
      // ataque/defesa dos monstros (ver CombatSystem.js:
      // MODO_HISTORIA_REDUCAO) sem reduzir XP/ouro, pra quem quer focar na
      // narrativa/exploração. Desmarcada por padrão = jogo normal.
      const labelModoHistoria = document.createElement("label");
      labelModoHistoria.style.cssText = "display:block;margin:14px 0;padding:10px;border:1px solid #7a5c34;border-radius:6px;background:#241b14;cursor:pointer;";
      const checkModoHistoria = document.createElement("input");
      checkModoHistoria.type = "checkbox";
      checkModoHistoria.id = "check-modo-historia";
      checkModoHistoria.checked = estado.modoHistoria;
      checkModoHistoria.style.marginRight = "8px";
      checkModoHistoria.onchange = () => {
        estado.modoHistoria = checkModoHistoria.checked;
        personagem.modoHistoria = estado.modoHistoria;
      };
      labelModoHistoria.appendChild(checkModoHistoria);
      labelModoHistoria.appendChild(document.createTextNode("📖 Modo História — monstros mais fracos (hp/ataque/defesa reduzidos), sem afetar XP/ouro. Ideal pra focar na narrativa e exploração."));
      painel.appendChild(labelModoHistoria);
      const btnVoltar = document.createElement("button");
      btnVoltar.textContent = "Voltar";
      btnVoltar.onclick = () => { estado.etapaIdx--; render(); };
      const btnIniciar = document.createElement("button");
      btnIniciar.className = "primario";
      btnIniciar.textContent = "Começar Aventura!";
      btnIniciar.onclick = () => onFinalizar(personagem);
      painel.appendChild(document.createElement("br"));
      painel.appendChild(btnVoltar);
      painel.appendChild(btnIniciar);
    }
  }

  function adicionarNavegacao(painel, estado, render, temSelecao) {
    painel.appendChild(document.createElement("br"));
    if (estado.etapaIdx > 0) {
      const btnVoltar = document.createElement("button");
      btnVoltar.textContent = "Voltar";
      btnVoltar.onclick = () => { estado.etapaIdx--; render(); };
      painel.appendChild(btnVoltar);
    }
    const btnAvancar = document.createElement("button");
    btnAvancar.className = "primario";
    btnAvancar.textContent = "Avançar";
    btnAvancar.disabled = !temSelecao();
    btnAvancar.onclick = () => { estado.etapaIdx++; render(); };
    painel.appendChild(btnAvancar);
  }

  render();
}
