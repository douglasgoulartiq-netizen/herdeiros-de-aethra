#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Expande src/data/gachaRoster.json de 24 para 100 personagens — task #49 do
backlog. Gera 76 personagens novos, mantendo a mesma taxonomia de 5
raridades (comum/incomum/raro/epico/lendario) e reservando pelo menos 10%
do total (>= 10 de 100) para lendários, como pedido.

Reaproveita fórmulas já existentes no projeto em vez de inventar novas:
- atributos/hpMax/mpMax escalam pela raridade com o mesmo multiplicador
  observado nos 24 personagens originais (reconstruído comparando as
  raridades de um mesmo personagem-classe: comum=1.0, incomum=1.15,
  raro=1.3, epico=1.5, lendario=1.75 — bate exatamente com
  zephyrion_furia_draconiana/mordak_quebramuralhas/nyxandra do roster
  original), aplicado sobre atributosBase/vidaBase/manaBase de
  classes.json (mesma fonte usada pros 24 originais).
- hpMax/mpMax usam a fórmula de CharacterFactory.calcularHpMax/calcularMpMax
  (vidaBase + CON*3, manaBase + INT*2) escalada pelo mesmo multiplicador.
- "despertar" NÃO é gerado aqui — depois de rodar este script, rode de novo
  gen_despertar.py (idempotente, cobre todo o roster automaticamente).
- compendium.json também não é tocado aqui — o gacha tem seu próprio painel
  (GachaUI.js) e não passa pelo bestiário de monstros.

Idempotente: remove qualquer personagem cujo id comece com "novo_" (prefixo
reservado pra esta geração) antes de reinserir, então pode rodar de novo com
o mesmo resultado.
"""
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROSTER_PATH = os.path.join(ROOT, "src", "data", "gachaRoster.json")
CLASSES_PATH = os.path.join(ROOT, "src", "data", "classes.json")

RACAS = ["elfo", "anao", "halfling", "orc", "draconato", "humano"]
CLASSES = ["guerreiro", "mago", "ladino", "clerigo", "barbaro", "patrulheiro"]
RARIDADES_ORDEM = ["comum", "incomum", "raro", "epico", "lendario"]

# Quantos personagens NOVOS por raridade — soma 76. Combinado aos 24
# originais (comum8/incomum6/raro5/epico3/lendario2), fecha o roster em 100
# com lendario=12 (12%, acima do mínimo de 10% pedido).
NOVOS_POR_RARIDADE = {"comum": 17, "incomum": 19, "raro": 18, "epico": 12, "lendario": 10}

MULT_ATRIBUTOS = {"comum": 1.0, "incomum": 1.15, "raro": 1.3, "epico": 1.5, "lendario": 1.75}
MULT_HABILIDADE = {"comum": 0.8, "incomum": 1.0, "raro": 1.2, "epico": 1.5, "lendario": 1.8}

# Facções plausíveis por raça (mistura variada, mesma ideia de espalhar
# regionalidade usada nos 24 originais — não é 1:1 estrito).
FACCOES_POR_RACA = {
    "elfo": ["guardioes_da_folha", "cavaleiros_do_vento_uivante", "ordem_dos_arquivistas"],
    "anao": ["forja_dos_anoes_cinzentos", "ordem_dos_arquivistas", "caravana_de_karn"],
    "halfling": ["caravana_de_karn", "cla_dos_ventos_dourados", "andarilhos_do_pantano"],
    "orc": ["legiao_das_cinzas", "andarilhos_do_pantano", "confraria_do_farol"],
    "draconato": ["legiao_das_cinzas", "confraria_do_farol", "coroa_de_aethra"],
    "humano": ["coroa_de_aethra", "guardioes_da_folha", "cla_dos_ventos_dourados"],
}

PRIMEIRO_NOME_POR_RACA = {
    "elfo": ["Sylvaine", "Aerindil", "Thalorin", "Elowen", "Faelar", "Isolde", "Caelith",
             "Nimriel", "Sorrel", "Aravel", "Lithael", "Vaelira", "Eryndor", "Miralys", "Quildan"],
    "anao": ["Bruna", "Thrain", "Dunna", "Borgin", "Kelda", "Grunnar", "Hilde", "Vorik",
             "Astrid", "Baldrek", "Sifrid", "Drogun", "Ymma", "Runna", "Torvik"],
    "halfling": ["Pip", "Rosalind", "Mellow", "Tansy", "Bramwell", "Poppy", "Fennic",
                 "Marigold", "Tobber", "Wren", "Nettle", "Cobb", "Daisy", "Figgs", "Merric"],
    "orc": ["Ghazak", "Ruka", "Thokka", "Vurg", "Ashna", "Drogul", "Kazra", "Morgath",
            "Uzka", "Grosk", "Nagra", "Vokka", "Rhaska", "Guldor", "Zhurga"],
    "draconato": ["Pyrren", "Aurexia", "Drassven", "Kirsara", "Voldrak", "Thessaly", "Rhogar",
                  "Sethara", "Balthirax", "Nymeriax", "Corvinax", "Ildrenne", "Varyx", "Ashkaris", "Zephyra"],
    "humano": ["Corwin", "Elandra", "Bastian", "Merida", "Osric", "Ivane", "Dessa",
               "Aldric", "Sanna", "Renwick", "Talia", "Garrick", "Miriel", "Cassia", "Edmund"],
}

EPITETOS = [
    "Punho de Aço", "Sombra Silenciosa", "Coração de Bronze", "Voz do Trovão", "Lâmina Errante",
    "Guarda do Amanhecer", "Fôlego de Cinzas", "Passo de Névoa", "Escudo Vivo", "Chama Contida",
    "Andarilho das Ruínas", "Canto da Tempestade", "Marca da Lua Cheia", "Ferro Frio", "Sussurro Verde",
    "Pedra que Anda", "Ecos do Passado", "Fúria Silenciosa", "Manto de Cinzas", "Espinho do Deserto",
    "Vigia das Fronteiras", "Faísca Perdida", "Guardiã das Marés", "Lâmina do Meio-Dia", "Ruído da Tormenta",
    "Sombra do Penhasco", "Punho Gentil", "Olhar de Bronze", "Trilha dos Ventos", "Chama do Norte",
    "Coração Selvagem", "Voz da Montanha", "Aço Sereno", "Passo Firme", "Névoa da Aurora",
    "Marca do Trovão", "Fogo Contido", "Escamas de Prata", "Andarilha Solitária", "Grito da Tempestade",
    "Punho de Vento", "Coração de Pedra", "Sombra Dourada", "Voz Serena", "Lâmina Silenciosa",
    "Guardião das Encostas", "Chama Errante", "Passo Sombrio", "Escudo de Bronze", "Sussurro da Névoa",
    "Ferro Ardente", "Manto do Vento Norte", "Trilha Escura", "Faísca do Amanhecer", "Marca Selvagem",
    "Olhar Distante", "Coração Fervente", "Punho Silencioso", "Ecos da Tempestade", "Vigia Silenciosa",
    "Sombra do Deserto", "Chama Eterna", "Espinho Frio", "Guarda da Bruma", "Andarilho do Trovão",
    "Lâmina da Aurora", "Passo do Vendaval", "Voz das Raízes", "Manto de Escamas", "Punho da Maré",
    "Coração Gélido", "Sussurro do Vento", "Grito Silencioso", "Escudo da Alvorada", "Faísca Selvagem",
]


def slugify(texto):
    nfkd = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", sem_acento.lower()).strip("_")


TIPO_CONFIG = {
    "dano_fisico": {"campo": "multiplicador", "base": 1.5, "extra": {"custoMP": 0, "cooldown": 2}},
    "dano_fisico_des": {"campo": "multiplicador", "base": 1.6, "extra": {"custoMP": 0, "cooldown": 2}},
    "dano_magico": {"campo": "multiplicador", "base": 1.8, "extra": {"custoMP": 9, "cooldown": 0}},
    "dano_ignora_defesa": {"campo": "multiplicador", "base": 1.3, "extra": {"custoMP": 0, "cooldown": 2}},
    "cura": {"campo": "multiplicador", "base": 1.9, "extra": {"custoMP": 8, "cooldown": 0}},
    "buff_ataque": {"campo": "valor", "base": 0.5, "extra": {"custoMP": 0, "cooldown": 3, "duracao": 1}},
    "buff_defesa": {"campo": "valor", "base": 0.22, "extra": {"custoMP": 0, "cooldown": 3, "duracao": 2}},
    "debuff_velocidade": {"campo": "valor", "base": 0.3, "extra": {"custoMP": 5, "cooldown": 3, "duracao": 3}},
}

# Tipos permitidos por classe, na proporção observada nos 24 personagens
# originais (índice cíclico decide qual tipo cada personagem novo recebe).
TIPOS_POR_CLASSE = {
    "guerreiro": ["dano_fisico", "dano_fisico", "dano_fisico", "buff_defesa"],
    "mago": ["dano_magico"],
    "ladino": ["dano_fisico_des"],
    "clerigo": ["cura"],
    "barbaro": ["buff_ataque", "buff_ataque", "buff_ataque", "dano_ignora_defesa"],
    "patrulheiro": ["debuff_velocidade", "debuff_velocidade", "dano_fisico_des"],
}

NOME_HABILIDADE = {
    "dano_fisico": ["Golpe de {ep}", "Investida de {ep}", "Corte de {ep}"],
    "dano_fisico_des": ["Ataque de {ep}", "Corte Ágil de {ep}", "Investida de {ep}"],
    "dano_magico": ["Explosão de {ep}", "Rajada de {ep}", "Feitiço de {ep}"],
    "dano_ignora_defesa": ["Fúria de {ep}", "Investida de {ep}"],
    "cura": ["Bênção de {ep}", "Luz de {ep}", "Toque de {ep}"],
    "buff_ataque": ["Fúria de {ep}", "Ímpeto de {ep}"],
    "buff_defesa": ["Postura de {ep}", "Guarda de {ep}"],
    "debuff_velocidade": ["Laço de {ep}", "Armadilha de {ep}"],
}

ELEMENTOS_MAGO = ["fogo", "gelo", "raio", "arcano", "vento", "natureza", "sombrio", "veneno"]

RACA_DESCRICAO = {
    "elfo": "Élfic{gen} de reflexos afiados e vínculo antigo com a natureza",
    "anao": "Anã{gen} de disciplina forjada nas montanhas e paciência de pedra",
    "halfling": "Pequen{gen} e ágil, subestimad{gen} por quem nunca viu {pron} em combate",
    "orc": "Orc de força bruta e lealdade absoluta a quem conquista seu respeito",
    "draconato": "Draconato de sangue ancestral, orgulhoso e implacável em batalha",
    "humano": "Human{gen} ambicios{gen}, movid{gen} por uma causa maior que si mesm{gen}",
}
CLASSE_DESCRICAO = {
    "guerreiro": "que aprendeu a segurar a linha de frente antes de aprender a ler",
    "mago": "que troca cautela por poder bruto a cada feitiço lançado",
    "ladino": "que resolve tudo antes que o inimigo perceba que a luta começou",
    "clerigo": "que carrega a fé como escudo e a cura como arma",
    "barbaro": "que só encontra clareza no meio da fúria de batalha",
    "patrulheiro": "que domina o terreno tanto quanto domina o arco",
}


def gerar_atributos(classe_id, classes_por_id, raridade):
    base = classes_por_id[classe_id]["atributosBase"]
    mult = MULT_ATRIBUTOS[raridade]
    return {k: max(1, round(v * mult)) for k, v in base.items()}


def gerar_hp_mp(classe_id, classes_por_id, raridade):
    c = classes_por_id[classe_id]
    mult = MULT_ATRIBUTOS[raridade]
    hp_comum = c["vidaBase"] + c["atributosBase"]["CON"] * 3
    mp_comum = c["manaBase"] + c["atributosBase"]["INT"] * 2
    return round(hp_comum * mult), round(mp_comum * mult)


def gerar_habilidade(personagem_id, classe_id, epiteto, raridade, indice_global):
    tipos = TIPOS_POR_CLASSE[classe_id]
    tipo = tipos[indice_global % len(tipos)]
    cfg = TIPO_CONFIG[tipo]
    valor = round(cfg["base"] * MULT_HABILIDADE[raridade], 2)
    nomes = NOME_HABILIDADE[tipo]
    nome_hab = nomes[indice_global % len(nomes)].format(ep=epiteto)
    hab = {
        "id": f"{slugify(nome_hab)}_{personagem_id.split('_')[0]}",
        "nome": nome_hab,
        "descricao": f"Habilidade de {classe_id}: {tipo.replace('_', ' ')} (valor base {valor}).",
        "tipo": tipo,
        **cfg["extra"],
        cfg["campo"]: valor,
    }
    if tipo == "dano_magico":
        hab["elemento"] = ELEMENTOS_MAGO[indice_global % len(ELEMENTOS_MAGO)]
    return hab


def gerar_descricao(raca_id, classe_id):
    gen = "a" if raca_id in ("elfo", "anao", "halfling", "humano") else ""
    pron = "ela" if raca_id in ("elfo", "anao", "halfling", "humano") else "ele"
    raca_txt = RACA_DESCRICAO[raca_id].format(gen=gen, pron=pron)
    return f"{raca_txt}, {CLASSE_DESCRICAO[classe_id]}."


def main():
    with open(ROSTER_PATH, "r", encoding="utf-8") as f:
        roster = json.load(f)
    with open(CLASSES_PATH, "r", encoding="utf-8") as f:
        classes_lista = json.load(f)
    classes_por_id = {c["id"]: c for c in classes_lista}

    roster = [p for p in roster if not p["id"].startswith("novo_")]
    ids_existentes = {p["id"] for p in roster}
    nomes_existentes = {p["nome"] for p in roster}

    plano = []
    for raridade in RARIDADES_ORDEM:
        plano.extend([raridade] * NOVOS_POR_RARIDADE[raridade])
    assert len(plano) == 76, f"esperado 76 personagens novos, plano tem {len(plano)}"

    usados_nome = set()
    novos = []
    indice_global = 0
    for i, raridade in enumerate(plano):
        raca_id = RACAS[i % len(RACAS)]
        classe_id = CLASSES[(i + i // len(RACAS)) % len(CLASSES)]  # roda o offset pra variar o pareamento raça x classe

        primeiros = PRIMEIRO_NOME_POR_RACA[raca_id]
        primeiro = None
        epiteto = None
        for tentativa in range(len(primeiros) * len(EPITETOS)):
            cand_primeiro = primeiros[(i + tentativa) % len(primeiros)]
            cand_epiteto = EPITETOS[(i * 7 + tentativa) % len(EPITETOS)]
            nome_completo = f"{cand_primeiro} {cand_epiteto}"
            if nome_completo not in nomes_existentes and nome_completo not in usados_nome:
                primeiro, epiteto = cand_primeiro, cand_epiteto
                break
        assert primeiro is not None, "não foi possível achar um nome único"
        usados_nome.add(f"{primeiro} {epiteto}")

        personagem_id = "novo_" + slugify(f"{primeiro}_{epiteto}")
        sufixo = 2
        while personagem_id in ids_existentes:
            personagem_id = "novo_" + slugify(f"{primeiro}_{epiteto}_{sufixo}")
            sufixo += 1
        ids_existentes.add(personagem_id)

        atributos = gerar_atributos(classe_id, classes_por_id, raridade)
        hp_max, mp_max = gerar_hp_mp(classe_id, classes_por_id, raridade)
        habilidade = gerar_habilidade(personagem_id, classe_id, epiteto, raridade, indice_global)
        faccoes = FACCOES_POR_RACA[raca_id]

        novos.append({
            "id": personagem_id,
            "nome": f"{primeiro} {epiteto}",
            "raridade": raridade,
            "racaId": raca_id,
            "classeId": classe_id,
            "facaoId": faccoes[indice_global % len(faccoes)],
            "descricao": gerar_descricao(raca_id, classe_id),
            "atributos": atributos,
            "hpMax": hp_max,
            "mpMax": mp_max,
            "habilidade": habilidade,
            "sprite": f"gacha_{personagem_id}.png",
        })
        indice_global += 1

    roster.extend(novos)

    with open(ROSTER_PATH, "w", encoding="utf-8") as f:
        json.dump(roster, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"{len(novos)} personagens novos gerados. Roster total: {len(roster)}.")
    print("Rode gen_despertar.py em seguida pra gerar o despertar de todo o roster.")


if __name__ == "__main__":
    main()
