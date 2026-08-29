#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera items.json e lootTables.json com variedade sistemática de raridades."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "src", "data")
os.makedirs(DATA_DIR, exist_ok=True)

RARITIES = [
    {"id": "comum",    "mult": 1.0, "cor": "#b0b0b0", "peso": 100, "ordem": 0},
    {"id": "incomum",  "mult": 1.3, "cor": "#4caf50", "peso": 45,  "ordem": 1},
    {"id": "raro",     "mult": 1.7, "cor": "#3d8bfd", "peso": 18,  "ordem": 2},
    {"id": "epico",    "mult": 2.3, "cor": "#a855f7", "peso": 6,   "ordem": 3},
    {"id": "lendario", "mult": 3.2, "cor": "#f5a524", "peso": 1,   "ordem": 4},
]
RARITY_BY_ID = {r["id"]: r for r in RARITIES}

WEAPONS = {
    "espada": {"icone": "espada", "atributo": "FOR", "dano_base": 6, "classe": "guerreiro",
        "nomes": ["Espada Enferrujada", "Espada de Ferro", "Espada Élfica", "Espada Flamejante", "Espada do Dragão Ancião"]},
    "machado": {"icone": "machado", "atributo": "FOR", "dano_base": 7, "classe": "barbaro",
        "nomes": ["Machado Lascado", "Machado de Guerra", "Machado dos Clãs", "Machado Vulcânico", "Machado do Titã"]},
    "adaga": {"icone": "adaga", "atributo": "DES", "dano_base": 4, "classe": "ladino", "critico": True,
        "nomes": ["Adaga Cega", "Adaga de Aço", "Adaga das Sombras", "Adaga Venenosa", "Presa da Noite Eterna"]},
    "cajado": {"icone": "cajado", "atributo": "INT", "dano_base": 5, "classe": "mago",
        "nomes": ["Cajado de Madeira", "Cajado Rúnico", "Cajado do Arcanista", "Cajado da Tempestade", "Cajado do Arquimago"]},
    "maca": {"icone": "maca", "atributo": "FOR", "dano_base": 5, "classe": "clerigo", "cura_bonus": True,
        "nomes": ["Maça Simples", "Maça Abençoada", "Maça do Clérigo Ancião", "Maça da Luz Divina", "Maça do Juízo Final"]},
    "arco": {"icone": "arco", "atributo": "DES", "dano_base": 6, "classe": "patrulheiro",
        "nomes": ["Arco Curto", "Arco de Teixo", "Arco Élfico", "Arco do Vento Uivante", "Arco da Caçadora Celestial"]},
}

ARMORS = {
    "armadura": {"icone": "armadura", "defesa_base": 4, "slot": "peito",
        "nomes": ["Roupas Surradas", "Armadura de Couro", "Cota de Malha", "Armadura Élfica", "Armadura do Guardião Eterno"]},
    "elmo": {"icone": "elmo", "defesa_base": 2, "slot": "cabeca",
        "nomes": ["Capuz Remendado", "Elmo de Ferro", "Elmo Rúnico", "Elmo do Vigilante", "Coroa do Rei Esquecido"]},
    "botas": {"icone": "botas", "defesa_base": 1, "slot": "pes", "velocidade_bonus": True,
        "nomes": ["Botas Gastas", "Botas de Couro", "Botas Élficas", "Botas do Vento", "Botas do Andarilho Fantasma"]},
    "escudo": {"icone": "escudo", "defesa_base": 3, "slot": "escudo",
        "nomes": ["Escudo de Madeira", "Escudo de Ferro", "Escudo Reforçado", "Escudo Flamejante", "Escudo da Muralha Divina"]},
}

def build_weapons():
    items = []
    for wid, w in WEAPONS.items():
        for i, r in enumerate(RARITIES):
            dano = round(w["dano_base"] * r["mult"])
            item = {
                "id": f"{wid}_{r['id']}",
                "nome": w["nomes"][i],
                "tipo": "arma",
                "subtipo": wid,
                "classeRecomendada": w["classe"],
                "raridade": r["id"],
                "icone": w["icone"],
                "dano": dano,
                "atributo": w["atributo"],
                "valor": round(15 * r["mult"] ** 2),
                "descricao": f"Uma {w['nomes'][i].lower()}. Dano baseado em {w['atributo']}.",
            }
            if w.get("critico"):
                item["bonusCritico"] = round(5 * r["mult"])
            if w.get("cura_bonus"):
                item["bonusCura"] = round(3 * r["mult"])
            items.append(item)
    return items

def build_armors():
    items = []
    for aid, a in ARMORS.items():
        for i, r in enumerate(RARITIES):
            defesa = round(a["defesa_base"] * r["mult"])
            item = {
                "id": f"{aid}_{r['id']}",
                "nome": a["nomes"][i],
                "tipo": "armadura",
                "subtipo": aid,
                "slot": a["slot"],
                "raridade": r["id"],
                "icone": a["icone"],
                "defesa": defesa,
                "valor": round(12 * r["mult"] ** 2),
                "descricao": f"{a['nomes'][i]}, oferece {defesa} de defesa.",
            }
            if a.get("velocidade_bonus"):
                item["bonusVelocidade"] = round(2 * r["mult"])
            items.append(item)
    return items

def build_consumables():
    items = [
        {"id": "pocao_vida_p", "nome": "Poção de Vida Pequena", "tipo": "consumivel", "subtipo": "cura",
         "raridade": "comum", "icone": "pocao_vida", "curaHP": 15, "valor": 10, "descricao": "Recupera 15 de HP."},
        {"id": "pocao_vida_m", "nome": "Poção de Vida Média", "tipo": "consumivel", "subtipo": "cura",
         "raridade": "incomum", "icone": "pocao_vida", "curaHP": 35, "valor": 28, "descricao": "Recupera 35 de HP."},
        {"id": "pocao_vida_g", "nome": "Poção de Vida Grande", "tipo": "consumivel", "subtipo": "cura",
         "raridade": "raro", "icone": "pocao_vida", "curaHP": 70, "valor": 60, "descricao": "Recupera 70 de HP."},
        {"id": "pocao_mana_p", "nome": "Poção de Mana Pequena", "tipo": "consumivel", "subtipo": "mana",
         "raridade": "comum", "icone": "pocao_mana", "curaMP": 10, "valor": 12, "descricao": "Recupera 10 de MP."},
        {"id": "pocao_mana_m", "nome": "Poção de Mana Média", "tipo": "consumivel", "subtipo": "mana",
         "raridade": "incomum", "icone": "pocao_mana", "curaMP": 25, "valor": 30, "descricao": "Recupera 25 de MP."},
        {"id": "antidoto", "nome": "Antídoto", "tipo": "consumivel", "subtipo": "cura_status",
         "raridade": "comum", "icone": "pocao_mana", "removeStatus": True, "valor": 8, "descricao": "Remove efeitos negativos."},
        {"id": "pao", "nome": "Pão", "tipo": "consumivel", "subtipo": "cura",
         "raridade": "comum", "icone": "pocao_vida", "curaHP": 8, "valor": 3, "descricao": "Um lanche simples. Recupera 8 de HP."},
    ]
    return items

def build_materials():
    items = []
    mats = [("erva", "Erva", "comum"), ("erva_rara", "Erva Rara Luminosa", "raro"),
            ("minerio", "Minério de Ferro", "comum"), ("minerio_raro", "Minério Élfico", "raro"),
            ("madeira", "Madeira", "comum"), ("gema", "Gema Bruta", "incomum"),
            ("gema_rara", "Gema Radiante", "epico")]
    icon_map = {"erva": "erva", "erva_rara": "erva", "minerio": "minerio", "minerio_raro": "minerio",
                "madeira": "madeira", "gema": "gema", "gema_rara": "gema"}
    for mid, nome, rar in mats:
        items.append({
            "id": mid, "nome": nome, "tipo": "material", "subtipo": "coleta",
            "raridade": rar, "icone": icon_map[mid], "valor": {"comum": 4, "incomum": 10, "raro": 22, "epico": 50}[rar],
            "descricao": f"{nome}, usado em receitas de forja e alquimia.",
        })
    return items

def build_misc():
    items = [
        {"id": "anel_forca", "nome": "Anel da Força Bruta", "tipo": "acessorio", "slot": "anel",
         "raridade": "raro", "icone": "anel", "bonusAtributo": {"FOR": 2}, "valor": 80, "descricao": "+2 de Força."},
        {"id": "anel_destreza", "nome": "Anel dos Reflexos", "tipo": "acessorio", "slot": "anel",
         "raridade": "raro", "icone": "anel", "bonusAtributo": {"DES": 2}, "valor": 80, "descricao": "+2 de Destreza."},
        {"id": "anel_simples", "nome": "Anel Simples", "tipo": "acessorio", "slot": "anel",
         "raridade": "comum", "icone": "anel", "bonusAtributo": {}, "valor": 15, "descricao": "Um anel sem encantamento, mas de bom gosto."},
        {"id": "amuleto_vida", "nome": "Amuleto da Vitalidade", "tipo": "acessorio", "slot": "amuleto",
         "raridade": "epico", "icone": "amuleto", "bonusAtributo": {"CON": 3}, "valor": 220, "descricao": "+3 de Constituição."},
        {"id": "amuleto_arcano", "nome": "Amuleto Arcano", "tipo": "acessorio", "slot": "amuleto",
         "raridade": "lendario", "icone": "amuleto", "bonusAtributo": {"INT": 4}, "valor": 500, "descricao": "+4 de Inteligência. Reliquia lendária."},
        {"id": "pergaminho_arcano", "nome": "Pergaminho Arcano", "tipo": "consumivel", "subtipo": "pergaminho",
         "raridade": "incomum", "icone": "pergaminho", "danoMagico": 20, "valor": 35, "descricao": "Uso único: causa 20 de dano mágico."},
        {"id": "pergaminho_fuga", "nome": "Pergaminho de Fuga", "tipo": "consumivel", "subtipo": "pergaminho",
         "raridade": "comum", "icone": "pergaminho", "fugaGarantida": True, "valor": 20, "descricao": "Garante fuga da batalha."},
        {"id": "adaga_enferrujada", "nome": "Adaga Enferrujada", "tipo": "arma", "subtipo": "adaga",
         "classeRecomendada": "ladino", "raridade": "comum", "icone": "adaga", "dano": 3, "atributo": "DES",
         "valor": 6, "descricao": "Item inicial de antecedente Criminoso."},
    ]
    return items

def build_starting_items():
    return [
        {"id": "pocao_vida_inicial", "nome": "Poção de Vida", "tipo": "consumivel", "subtipo": "cura",
         "raridade": "comum", "icone": "pocao_vida", "curaHP": 15, "valor": 10, "descricao": "Recupera 15 de HP."},
    ]

def build():
    items = (build_weapons() + build_armors() + build_consumables() +
             build_materials() + build_misc())
    # remove duplicado de pocao_vida_p (usado tb como item inicial de background) - ja unico por id
    with open(os.path.join(DATA_DIR, "items.json"), "w", encoding="utf-8") as f:
        json.dump({"raridades": RARITIES, "itens": items}, f, ensure_ascii=False, indent=2)
    print("items.json ok:", len(items), "itens")
    return items

if __name__ == "__main__":
    build()
