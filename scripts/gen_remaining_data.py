#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera races.json, classes.json, backgrounds.json, traits.json,
monsters.json, lootTables.json, quests.json e recipes.json."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "src", "data")

# ---------------------------------------------------------------------------
RACES = [
    {"id": "humano", "nome": "Humano", "bonus": {"FOR": 1, "DES": 1, "CON": 1, "INT": 1},
     "traco": "adaptavel", "descricaoTraco": "Versátil: ganha 5% de XP extra em todas as batalhas.",
     "descricao": "Adaptáveis e ambiciosos, encontrados em toda parte do reino."},
    {"id": "elfo", "nome": "Elfo", "bonus": {"DES": 2, "INT": 1},
     "traco": "visao_aguçada", "descricaoTraco": "Visão aguçada: maior chance de encontrar baús escondidos e +2 de iniciativa em batalha.",
     "descricao": "Ágeis e perceptivos, vivem em harmonia com as florestas antigas."},
    {"id": "anao", "nome": "Anão", "bonus": {"CON": 2, "FOR": 1},
     "traco": "resistente", "descricaoTraco": "Resistente: efeitos negativos (veneno, lentidão) duram 1 turno a menos.",
     "descricao": "Robustos mineradores das montanhas, difíceis de derrubar."},
    {"id": "orc", "nome": "Orc", "bonus": {"FOR": 2, "CON": 1},
     "traco": "furia_orc", "descricaoTraco": "Fúria do Orc: causa 30% de dano extra quando o HP está abaixo de 30%.",
     "descricao": "Guerreiros orgulhosos e ferozes em combate."},
    {"id": "halfling", "nome": "Halfling", "bonus": {"DES": 2, "INT": 1},
     "traco": "sortudo", "descricaoTraco": "Sortudo: uma vez por batalha, re-rola automaticamente um resultado de dado igual a 1.",
     "descricao": "Pequenos, rápidos e surpreendentemente sortudos."},
    {"id": "draconato", "nome": "Draconato", "bonus": {"INT": 2, "FOR": 1},
     "traco": "sopro_elemental", "descricaoTraco": "Sopro Elemental: habilidade extra de dano em área, disponível uma vez por batalha.",
     "descricao": "Descendentes de dragões, carregam magia élemental no sangue."},
]

# ---------------------------------------------------------------------------
CLASSES = [
    {"id": "guerreiro", "nome": "Guerreiro", "iconeArma": "espada",
     "atributosBase": {"FOR": 8, "DES": 5, "CON": 7, "INT": 3},
     "crescimento": {"FOR": 3, "DES": 1, "CON": 2, "INT": 0},
     "vidaBase": 34, "manaBase": 5,
     "habilidades": [
        {"id": "golpe_poderoso", "nome": "Golpe Poderoso", "descricao": "Causa 150% do dano físico normal.", "custoMP": 0, "cooldown": 2, "tipo": "dano_fisico", "multiplicador": 1.5},
        {"id": "grito_de_guerra", "nome": "Grito de Guerra", "descricao": "+30% de defesa por 2 turnos.", "custoMP": 0, "cooldown": 3, "tipo": "buff_defesa", "duracao": 2, "valor": 0.3}
     ]},
    {"id": "mago", "nome": "Mago", "iconeArma": "cajado",
     "atributosBase": {"FOR": 3, "DES": 5, "CON": 4, "INT": 9},
     "crescimento": {"FOR": 0, "DES": 1, "CON": 1, "INT": 3},
     "vidaBase": 22, "manaBase": 26,
     "habilidades": [
        {"id": "bola_de_fogo", "nome": "Bola de Fogo", "descricao": "Dano mágico em área baseado em Inteligência.", "custoMP": 10, "cooldown": 0, "tipo": "dano_magico", "multiplicador": 2.0},
        {"id": "escudo_arcano", "nome": "Escudo Arcano", "descricao": "Reduz o dano recebido pela metade por 2 turnos.", "custoMP": 8, "cooldown": 3, "tipo": "buff_defesa", "duracao": 2, "valor": 0.5}
     ]},
    {"id": "ladino", "nome": "Ladino", "iconeArma": "adaga",
     "atributosBase": {"FOR": 5, "DES": 9, "CON": 4, "INT": 4},
     "crescimento": {"FOR": 1, "DES": 3, "CON": 1, "INT": 0},
     "vidaBase": 26, "manaBase": 8,
     "habilidades": [
        {"id": "ataque_furtivo", "nome": "Ataque Furtivo", "descricao": "Dano baseado em Destreza com chance de crítico dobrada.", "custoMP": 0, "cooldown": 2, "tipo": "dano_fisico_des", "multiplicador": 1.8},
        {"id": "fuga_agil", "nome": "Fuga Ágil", "descricao": "Garante fuga bem-sucedida da batalha.", "custoMP": 0, "cooldown": 4, "tipo": "fuga"}
     ]},
    {"id": "clerigo", "nome": "Clérigo", "iconeArma": "maca",
     "atributosBase": {"FOR": 6, "DES": 4, "CON": 6, "INT": 7},
     "crescimento": {"FOR": 1, "DES": 0, "CON": 2, "INT": 2},
     "vidaBase": 28, "manaBase": 20,
     "habilidades": [
        {"id": "cura", "nome": "Cura", "descricao": "Recupera HP baseado em Inteligência.", "custoMP": 8, "cooldown": 0, "tipo": "cura", "multiplicador": 2.2},
        {"id": "luz_sagrada", "nome": "Luz Sagrada", "descricao": "Dano extra, especialmente contra mortos-vivos.", "custoMP": 10, "cooldown": 2, "tipo": "dano_magico", "multiplicador": 1.7}
     ]},
    {"id": "barbaro", "nome": "Bárbaro", "iconeArma": "machado",
     "atributosBase": {"FOR": 9, "DES": 4, "CON": 8, "INT": 2},
     "crescimento": {"FOR": 3, "DES": 0, "CON": 2, "INT": 0},
     "vidaBase": 36, "manaBase": 4,
     "habilidades": [
        {"id": "furia", "nome": "Fúria", "descricao": "Dobra o dano do próximo ataque, mas reduz a defesa em 20% por 1 turno.", "custoMP": 0, "cooldown": 3, "tipo": "buff_ataque", "duracao": 1, "valor": 1.0},
        {"id": "investida", "nome": "Investida", "descricao": "Dano físico que ignora parte da defesa inimiga.", "custoMP": 0, "cooldown": 2, "tipo": "dano_ignora_defesa", "multiplicador": 1.4}
     ]},
    {"id": "patrulheiro", "nome": "Patrulheiro", "iconeArma": "arco",
     "atributosBase": {"FOR": 5, "DES": 8, "CON": 5, "INT": 4},
     "crescimento": {"FOR": 1, "DES": 2, "CON": 1, "INT": 1},
     "vidaBase": 27, "manaBase": 10,
     "habilidades": [
        {"id": "tiro_certeiro", "nome": "Tiro Certeiro", "descricao": "Ataque à distância com chance de crítico aumentada.", "custoMP": 0, "cooldown": 2, "tipo": "dano_fisico_des", "multiplicador": 1.6},
        {"id": "armadilha", "nome": "Armadilha", "descricao": "Reduz a velocidade (iniciativa) do inimigo.", "custoMP": 5, "cooldown": 3, "tipo": "debuff_velocidade", "duracao": 3, "valor": 0.4}
     ]},
]

# ---------------------------------------------------------------------------
BACKGROUNDS = [
    {"id": "soldado", "nome": "Soldado", "pericia": "Intimidação",
     "descricao": "Serviu nas tropas do reino antes de se tornar aventureiro.",
     "itemInicial": "pocao_vida_inicial", "ouroInicial": 15},
    {"id": "nobre", "nome": "Nobre", "pericia": "Persuasão",
     "descricao": "Cresceu entre riquezas, mas busca glória própria.",
     "itemInicial": "anel_simples", "ouroInicial": 60},
    {"id": "criminoso", "nome": "Criminoso", "pericia": "Furtividade",
     "descricao": "Conhece os becos escuros e a arte de passar despercebido.",
     "itemInicial": "adaga_enferrujada", "ouroInicial": 20},
    {"id": "eremita", "nome": "Eremita", "pericia": "Sobrevivência",
     "descricao": "Viveu anos isolado, estudando ervas e a natureza.",
     "itemInicial": "erva", "ouroInicial": 10},
    {"id": "andarilho_do_povo", "nome": "Andarilho do Povo", "pericia": "Empatia",
     "descricao": "Viajou de vila em vila, sempre disposto a ajudar.",
     "itemInicial": "pao", "ouroInicial": 25},
    {"id": "sabio", "nome": "Sábio", "pericia": "Conhecimento Arcano",
     "descricao": "Dedicou a vida ao estudo de textos antigos e magia.",
     "itemInicial": "pergaminho_arcano", "ouroInicial": 20},
]

# ---------------------------------------------------------------------------
TRAITS = [
    {"id": "corajoso", "nome": "Corajoso", "descricao": "+3 de iniciativa em batalha quando o HP está em 30% ou menos."},
    {"id": "cauteloso", "nome": "Cauteloso", "descricao": "+20% de defesa no primeiro turno de cada batalha."},
    {"id": "ganancioso", "nome": "Ganancioso", "descricao": "+10% de chance de item raro ou melhor em drops, mas começa com 20% menos ouro."},
]

# ---------------------------------------------------------------------------
MONSTERS = [
    {"id": "slime", "nome": "Slime", "nivel": 1, "bioma": ["floresta"], "sprite": "mob_slime",
     "hp": 20, "atk": 4, "defesa": 1, "vel": 5, "xp": 8, "ouroMin": 3, "ouroMax": 6},
    {"id": "morcego", "nome": "Morcego", "nivel": 1, "bioma": ["floresta"], "sprite": "mob_morcego",
     "hp": 16, "atk": 5, "defesa": 1, "vel": 11, "xp": 9, "ouroMin": 2, "ouroMax": 5},
    {"id": "lobo", "nome": "Lobo", "nivel": 2, "bioma": ["floresta"], "sprite": "mob_lobo",
     "hp": 28, "atk": 7, "defesa": 2, "vel": 9, "xp": 14, "ouroMin": 5, "ouroMax": 10},
    {"id": "goblin", "nome": "Goblin", "nivel": 2, "bioma": ["floresta", "estrada"], "sprite": "mob_goblin",
     "hp": 24, "atk": 6, "defesa": 2, "vel": 7, "xp": 12, "ouroMin": 6, "ouroMax": 12},
    {"id": "bandido", "nome": "Bandido", "nivel": 3, "bioma": ["estrada", "floresta"], "sprite": "mob_bandido",
     "hp": 32, "atk": 9, "defesa": 3, "vel": 8, "xp": 19, "ouroMin": 10, "ouroMax": 20},
    {"id": "esqueleto", "nome": "Esqueleto", "nivel": 3, "bioma": ["masmorra"], "sprite": "mob_esqueleto",
     "hp": 30, "atk": 8, "defesa": 4, "vel": 5, "xp": 18, "ouroMin": 7, "ouroMax": 14},
    {"id": "aranha_gigante", "nome": "Aranha Gigante", "nivel": 3, "bioma": ["masmorra"], "sprite": "mob_aranha_gigante",
     "hp": 34, "atk": 9, "defesa": 3, "vel": 8, "xp": 20, "ouroMin": 8, "ouroMax": 15},
    {"id": "orc_selvagem", "nome": "Orc Selvagem", "nivel": 4, "bioma": ["masmorra", "floresta"], "sprite": "mob_orc_selvagem",
     "hp": 45, "atk": 12, "defesa": 5, "vel": 6, "xp": 30, "ouroMin": 15, "ouroMax": 25},
    {"id": "dragao_jovem", "nome": "Dragão Jovem", "nivel": 6, "bioma": ["masmorra"], "sprite": "mob_dragao_jovem",
     "hp": 120, "atk": 20, "defesa": 8, "vel": 7, "xp": 150, "ouroMin": 80, "ouroMax": 150, "chefe": True},
]

# ---------------------------------------------------------------------------
def loot_tables():
    return {
        "slime": {"chanceDrop": 0.55, "pool": [
            {"itemId": "erva", "peso": 40}, {"itemId": "gema", "peso": 10},
            {"itemId": "pocao_vida_p", "peso": 25}, {"itemId": "pocao_mana_p", "peso": 15}]},
        "morcego": {"chanceDrop": 0.5, "pool": [
            {"itemId": "erva", "peso": 35}, {"itemId": "pocao_mana_p", "peso": 25},
            {"itemId": "adaga_comum", "peso": 5}]},
        "lobo": {"chanceDrop": 0.6, "pool": [
            {"itemId": "madeira", "peso": 30}, {"itemId": "pocao_vida_p", "peso": 25},
            {"itemId": "botas_comum", "peso": 15}, {"itemId": "erva_rara", "peso": 8}]},
        "goblin": {"chanceDrop": 0.6, "pool": [
            {"itemId": "adaga_comum", "peso": 20}, {"itemId": "minerio", "peso": 25},
            {"itemId": "pocao_vida_p", "peso": 25}, {"itemId": "escudo_comum", "peso": 10}]},
        "bandido": {"chanceDrop": 0.65, "pool": [
            {"itemId": "adaga_incomum", "peso": 15}, {"itemId": "armadura_comum", "peso": 20},
            {"itemId": "pocao_vida_m", "peso": 20}, {"itemId": "anel_simples", "peso": 10},
            {"itemId": "gema", "peso": 12}]},
        "esqueleto": {"chanceDrop": 0.65, "pool": [
            {"itemId": "espada_comum", "peso": 18}, {"itemId": "elmo_comum", "peso": 18},
            {"itemId": "minerio", "peso": 20}, {"itemId": "pocao_mana_m", "peso": 15},
            {"itemId": "pergaminho_fuga", "peso": 8}]},
        "aranha_gigante": {"chanceDrop": 0.65, "pool": [
            {"itemId": "cajado_incomum", "peso": 14}, {"itemId": "botas_incomum", "peso": 16},
            {"itemId": "gema", "peso": 18}, {"itemId": "pocao_vida_m", "peso": 20},
            {"itemId": "erva_rara", "peso": 10}]},
        "orc_selvagem": {"chanceDrop": 0.75, "pool": [
            {"itemId": "machado_incomum", "peso": 18}, {"itemId": "armadura_incomum", "peso": 16},
            {"itemId": "escudo_incomum", "peso": 14}, {"itemId": "pocao_vida_g", "peso": 12},
            {"itemId": "minerio_raro", "peso": 10}, {"itemId": "anel_forca", "peso": 5}]},
        "dragao_jovem": {"chanceDrop": 1.0, "pool": [
            {"itemId": "espada_lendario", "peso": 8}, {"itemId": "cajado_lendario", "peso": 6},
            {"itemId": "machado_lendario", "peso": 6}, {"itemId": "arco_lendario", "peso": 6},
            {"itemId": "amuleto_arcano", "peso": 10}, {"itemId": "armadura_epico", "peso": 14},
            {"itemId": "gema_rara", "peso": 20}, {"itemId": "pocao_vida_g", "peso": 30}]},
        # baus
        "bau_comum": {"chanceDrop": 1.0, "pool": [
            {"itemId": "pocao_vida_p", "peso": 30}, {"itemId": "pocao_mana_p", "peso": 25},
            {"itemId": "erva", "peso": 20}, {"itemId": "minerio", "peso": 20},
            {"itemId": "escudo_comum", "peso": 5}]},
        "bau_raro": {"chanceDrop": 1.0, "pool": [
            {"itemId": "espada_raro", "peso": 12}, {"itemId": "cajado_raro", "peso": 12},
            {"itemId": "armadura_raro", "peso": 15}, {"itemId": "botas_raro", "peso": 15},
            {"itemId": "anel_destreza", "peso": 10}, {"itemId": "pocao_vida_g", "peso": 20},
            {"itemId": "gema_rara", "peso": 16}]},
        "bau_epico": {"chanceDrop": 1.0, "pool": [
            {"itemId": "arco_epico", "peso": 15}, {"itemId": "maca_epico", "peso": 15},
            {"itemId": "elmo_epico", "peso": 15}, {"itemId": "amuleto_vida", "peso": 20},
            {"itemId": "escudo_epico", "peso": 15}, {"itemId": "pergaminho_arcano", "peso": 20}]},
    }

# ---------------------------------------------------------------------------
QUESTS = [
    {"id": "q1_ratos_no_celeiro", "nome": "Pragas no Celeiro", "tipo": "matar",
     "npcId": "npc_fazendeiro", "regiao": "vila",
     "alvo": "slime", "quantidade": 3,
     "descricao": "O fazendeiro pede ajuda para eliminar 3 slimes que invadiram o celeiro.",
     "recompensaOuro": 25, "recompensaXP": 20, "recompensaItemId": "pocao_vida_m"},
    {"id": "q2_lobos_da_floresta", "nome": "Uivos na Noite", "tipo": "matar",
     "npcId": "npc_cacador", "regiao": "floresta",
     "alvo": "lobo", "quantidade": 4,
     "descricao": "Um caçador teme que uma alcateia de lobos ataque a estrada. Elimine 4 lobos.",
     "recompensaOuro": 40, "recompensaXP": 35, "recompensaItemId": "botas_incomum"},
    {"id": "q3_colar_perdido", "nome": "O Colar Perdido", "tipo": "coletar",
     "npcId": "npc_anciao", "regiao": "vila",
     "itemAlvo": "gema", "quantidade": 2,
     "descricao": "O ancião da vila perdeu um colar com duas gemas. Encontre 2 gemas na floresta.",
     "recompensaOuro": 30, "recompensaXP": 25, "recompensaItemId": "amuleto_vida"},
    {"id": "q4_mercador_desaparecido", "nome": "O Mercador Desaparecido", "tipo": "explorar",
     "npcId": "npc_guarda", "regiao": "masmorra",
     "localAlvo": "entrada_masmorra",
     "descricao": "Um mercador desapareceu perto da masmorra antiga. Explore a entrada e reporte o que encontrar.",
     "recompensaOuro": 35, "recompensaXP": 40, "recompensaItemId": "escudo_incomum"},
    {"id": "q5_o_dragao_jovem", "nome": "A Fera nas Profundezas", "tipo": "matar",
     "npcId": "npc_guarda", "regiao": "masmorra",
     "alvo": "dragao_jovem", "quantidade": 1,
     "descricao": "Rumores falam de um jovem dragão nas profundezas da masmorra. Derrote-o para provar seu valor.",
     "recompensaOuro": 150, "recompensaXP": 150, "recompensaItemId": "amuleto_arcano"},
]

NPCS = [
    {"id": "npc_fazendeiro", "nome": "Fazendeiro Tobias", "regiao": "vila", "x": 6, "y": 5, "dialogo": "Esses slimes estão destruindo minha colheita!"},
    {"id": "npc_cacador", "nome": "Caçador Elric", "regiao": "vila", "x": 10, "y": 8, "dialogo": "Os lobos andam ousados demais ultimamente..."},
    {"id": "npc_anciao", "nome": "Ancião Doran", "regiao": "vila", "x": 4, "y": 10, "dialogo": "Perdi um colar de família na floresta, há anos."},
    {"id": "npc_guarda", "nome": "Guarda Helena", "regiao": "vila", "x": 14, "y": 6, "dialogo": "Tome cuidado perto da masmorra antiga."},
    {"id": "npc_mercador", "nome": "Mercador Baltazar", "regiao": "vila", "x": 8, "y": 12, "dialogo": "Compro e vendo de tudo! Dê uma olhada."},
]

# ---------------------------------------------------------------------------
RECIPES = [
    {"id": "receita_pocao_vida_m", "nome": "Poção de Vida Média", "resultadoId": "pocao_vida_m",
     "ingredientes": [{"itemId": "erva", "quantidade": 3}, {"itemId": "gema", "quantidade": 1}]},
    {"id": "receita_pocao_mana_m", "nome": "Poção de Mana Média", "resultadoId": "pocao_mana_m",
     "ingredientes": [{"itemId": "erva_rara", "quantidade": 2}, {"itemId": "gema", "quantidade": 1}]},
    {"id": "receita_elmo_comum", "nome": "Forjar Elmo de Ferro", "resultadoId": "elmo_comum",
     "ingredientes": [{"itemId": "minerio", "quantidade": 4}, {"itemId": "madeira", "quantidade": 1}]},
    {"id": "receita_escudo_comum", "nome": "Forjar Escudo de Madeira", "resultadoId": "escudo_comum",
     "ingredientes": [{"itemId": "madeira", "quantidade": 5}]},
    {"id": "receita_antidoto", "nome": "Preparar Antídoto", "resultadoId": "antidoto",
     "ingredientes": [{"itemId": "erva", "quantidade": 2}]},
]

# ---------------------------------------------------------------------------
def write(name, data):
    with open(os.path.join(DATA_DIR, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(name, "ok")

if __name__ == "__main__":
    write("races.json", RACES)
    write("classes.json", CLASSES)
    write("backgrounds.json", BACKGROUNDS)
    write("traits.json", TRAITS)
    write("monsters.json", MONSTERS)
    write("lootTables.json", loot_tables())
    write("quests.json", QUESTS)
    write("npcs.json", NPCS)
    write("recipes.json", RECIPES)
