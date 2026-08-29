#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o campo aditivo "despertar" (Despertar de Arma Secreta) para cada
personagem de src/data/gachaRoster.json — task #36 do backlog. Não remove
nem substitui nenhum campo existente, só adiciona "despertar": {...} em cada
entrada, então é seguro rodar de novo (idempotente: sobrescreve só esse
campo, sempre com o mesmo resultado pra cada personagem, sem aleatoriedade,
pra não mudar toda vez que alguém rodar o script de novo).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "src", "data", "gachaRoster.json")

NIVEL_POR_RARIDADE = {"comum": 12, "incomum": 15, "raro": 18, "epico": 21, "lendario": 24}
BONUS_ATRIBUTO_POR_RARIDADE = {"comum": 0.08, "incomum": 0.10, "raro": 0.12, "epico": 0.15, "lendario": 0.18}
BONUS_HABILIDADE_POR_RARIDADE = {"comum": 0.15, "incomum": 0.20, "raro": 0.25, "epico": 0.30, "lendario": 0.35}

GATILHO_RACA = {
    "elfo": "quando o sangue élfico ancestral finalmente reconhece {nome} como digna herdeira das florestas antigas",
    "anao": "no instante em que a linhagem dos anões da montanha desperta na forja interior de {nome}",
    "halfling": "quando a coragem inesperada que sempre viveu escondida em {nome} finalmente se recusa a se esconder",
    "orc": "quando a fúria ancestral orc, contida por tanto tempo, se ergue em {nome} sem mais amarras",
    "humano": "quando a determinação obstinada de {nome} atravessa o limite que separa mortais de lendas",
    "draconato": "quando o sangue de dragão que corre nas veias de {nome} finalmente ferve até a superfície",
}

ARMA_POR_CLASSE = {
    "barbaro": "Punhos de {epiteto}",
    "mago": "Grimório de {epiteto}",
    "guerreiro": "Lâmina de {epiteto}",
    "clerigo": "Relicário de {epiteto}",
    "ladino": "Adaga de {epiteto}",
    "patrulheiro": "Arco de {epiteto}",
}

EPITETO_POR_RARIDADE = {
    "comum": ["Ferro Desperto", "Brasa Contida", "Vontade Firme"],
    "incomum": ["Aço Ancestral", "Eco da Tempestade", "Raiz Profunda"],
    "raro": ["Fogo Sagrado", "Sombra Absoluta", "Vento Cortante"],
    "epico": ["Fúria dos Ancestrais", "Granito Eterno", "Mil Ecos"],
    "lendario": ["Juízo Final", "Forja do Início dos Tempos"],
}

CLASSE_TIE_IN = {
    "barbaro": "sua fúria em combate deixa de ser instinto cru e vira uma arma consciente",
    "mago": "os feitiços que antes exigiam concentração agora fluem quase sem esforço",
    "guerreiro": "cada golpe carrega o peso de uma disciplina que levou uma vida inteira pra forjar",
    "clerigo": "a fé que sempre guiou suas mãos agora também guia o campo de batalha ao redor",
    "ladino": "os movimentos que antes eram só velocidade agora são pura precisão letal",
    "patrulheiro": "a trilha que sempre seguiu se torna a trilha que os inimigos não conseguem escapar",
}


def gerar_despertar(personagem):
    raridade = personagem["raridade"]
    raca = personagem["racaId"]
    classe = personagem["classeId"]
    nome = personagem["nome"]
    habilidade_nome = personagem["habilidade"]["nome"]

    epitetos = EPITETO_POR_RARIDADE.get(raridade, EPITETO_POR_RARIDADE["comum"])
    # Escolha determinística (não aleatória) baseada no id, pra ser sempre a
    # mesma toda vez que o script rodar.
    idx = sum(ord(c) for c in personagem["id"]) % len(epitetos)
    epiteto = epitetos[idx]
    nome_arma = ARMA_POR_CLASSE.get(classe, "Arma de {epiteto}").format(epiteto=epiteto)

    gatilho = GATILHO_RACA.get(raca, "quando algo desperta em {nome}").format(nome=nome)
    tie_in = CLASSE_TIE_IN.get(classe, "seu poder de combate cresce visivelmente")

    gatilho_capitalizado = gatilho[0].upper() + gatilho[1:]
    primeiro_nome = nome.split()[0].rstrip(",;.")
    narrativa = (
        f"{gatilho_capitalizado}, {nome_arma} se manifesta pela primeira vez — e {tie_in}: "
        f"\"{habilidade_nome}\" nunca mais será apenas uma técnica aprendida. Agora é parte de quem {primeiro_nome} se tornou."
    )

    atributos = personagem["atributos"]
    dois_maiores = sorted(atributos.keys(), key=lambda k: atributos[k], reverse=True)[:2]
    bonus_pct = BONUS_ATRIBUTO_POR_RARIDADE[raridade]
    bonus_atributos = {}
    for attr in dois_maiores:
        bonus_atributos[attr] = max(1, round(atributos[attr] * bonus_pct))

    return {
        "nivelRequerido": NIVEL_POR_RARIDADE[raridade],
        "nomeArma": nome_arma,
        "narrativa": narrativa,
        "bonusAtributos": bonus_atributos,
        "bonusHabilidadeMultiplicador": BONUS_HABILIDADE_POR_RARIDADE[raridade],
    }


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        roster = json.load(f)

    for personagem in roster:
        personagem["despertar"] = gerar_despertar(personagem)

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(roster, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"despertar gerado para {len(roster)} personagens do gacha.")


if __name__ == "__main__":
    main()
