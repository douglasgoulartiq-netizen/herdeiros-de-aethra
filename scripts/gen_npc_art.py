#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de retratos (portraits) para os NPCs fixos da vila.

Reaproveita a mesma maquinaria de "palette-swap" usada em gen_assets.py
(desenho parametrizado do humanoide em draw_humanoid, overlay de arma em
draw_weapon_overlay, contorno em outline_shape etc.) para manter os
retratos visualmente consistentes com os sprites de personagem e retratos
de gacha ja existentes em assets/sprites/. Cada NPC recebe uma paleta e
pequenos acessorios de silhueta proprios (chapeu de palha, robe, capacete,
capa...) para nao repetir o marcador generico usado hoje para todos.

Uso:
    python3 scripts/gen_npc_art.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)

# Reaproveita funcoes/constantes do gerador de assets original em vez de
# reinventar o desenho pixel a pixel (mesmo padrao de gen_gacha_roster_art.py).
import gen_assets as ga  # noqa: E402

SPRITES_DIR = ga.SPRITES_DIR  # assets/sprites/ -- mesma pasta dos pc_*/gacha_*.png
NPCS_PATH = os.path.join(ROOT, "src", "data", "npcs.json")

STRAW = (218, 178, 90, 255)
STRAW_DARK = (188, 148, 66, 255)
METAL = (196, 200, 208, 255)
METAL_DARK = (150, 154, 162, 255)


def add_straw_hat(img):
    """Chapeu de palha de aba larga (fazendeiro)."""
    ga.rect(img, 3, 1, 12, 1, STRAW)
    ga.rect(img, 5, 0, 10, 0, STRAW_DARK)
    ga.rect(img, 4, 2, 11, 2, STRAW_DARK)
    return img


def add_beard(img, hair):
    """Barba longa cobrindo o queixo (anciao)."""
    ga.rect(img, 5, 6, 10, 8, hair)
    ga.px(img, 6, 4, (30, 24, 22, 255))
    ga.px(img, 9, 4, (30, 24, 22, 255))
    return img


def add_helmet(img, metal, metal_dark):
    """Capacete simples de guarda, cobrindo o topo da cabeca."""
    ga.rect(img, 5, 1, 10, 3, metal)
    ga.rect(img, 5, 3, 10, 3, metal_dark)
    ga.px(img, 4, 3, metal_dark)
    ga.px(img, 11, 3, metal_dark)
    return img


def add_cape_and_pouch(img, cape_color, pouch_color):
    """Capa curta atras do ombro + bolsa de moedas na cintura (mercador)."""
    ga.rect(img, 11, 7, 12, 13, cape_color)
    ga.rect(img, 2, 11, 3, 13, pouch_color)
    return img


def build_fazendeiro():
    rp = ga.RACE_PALETTES["humano"]
    armor = (150, 120, 70, 255)
    armor2 = (112, 88, 50, 255)
    accent = (196, 158, 96, 255)
    img = ga.draw_humanoid(rp["skin"], rp["hair"], armor, armor2, accent, pose="idle")
    add_straw_hat(img)
    ga.outline_shape(img)
    return img


def build_cacador():
    rp = ga.RACE_PALETTES["humano"]
    cs = ga.CLASS_STYLE["patrulheiro"]
    img = ga.draw_humanoid(rp["skin"], (60, 42, 30, 255), cs["armor"], cs["armor2"], cs["accent"], pose="idle")
    weapon = ga.draw_weapon_overlay("bow", cs["accent"])
    frame = ga.Image.alpha_composite(img, weapon)
    return frame


def build_anciao():
    rp = ga.RACE_PALETTES["humano"]
    cs = ga.CLASS_STYLE["clerigo"]
    hair = (222, 222, 222, 255)
    img = ga.draw_humanoid(rp["skin"], hair, cs["armor"], cs["armor2"], cs["accent"], pose="idle")
    add_beard(img, hair)
    weapon = ga.draw_weapon_overlay("staff", cs["accent"])
    frame = ga.Image.alpha_composite(img, weapon)
    ga.outline_shape(frame)
    return frame


def build_guarda():
    rp = ga.RACE_PALETTES["humano"]
    armor = (70, 92, 122, 255)
    armor2 = (48, 66, 92, 255)
    accent = (210, 216, 224, 255)
    img = ga.draw_humanoid(rp["skin"], METAL, armor, armor2, accent, pose="idle")
    add_helmet(img, METAL, METAL_DARK)
    weapon = ga.draw_weapon_overlay("sword", accent)
    frame = ga.Image.alpha_composite(img, weapon)
    ga.outline_shape(frame)
    return frame


def build_mercador():
    rp = ga.RACE_PALETTES["humano"]
    armor = (128, 46, 128, 255)
    armor2 = (94, 30, 96, 255)
    accent = (212, 176, 60, 255)
    img = ga.draw_humanoid(rp["skin"], rp["hair"], armor, armor2, accent, pose="idle")
    add_cape_and_pouch(img, (176, 46, 54, 255), (212, 176, 60, 255))
    ga.outline_shape(img)
    return img


NPC_BUILDERS = {
    "npc_fazendeiro": build_fazendeiro,
    "npc_cacador": build_cacador,
    "npc_anciao": build_anciao,
    "npc_guarda": build_guarda,
    "npc_mercador": build_mercador,
}


def build_npc_art():
    with open(NPCS_PATH, "r", encoding="utf-8") as f:
        npcs = json.load(f)

    os.makedirs(SPRITES_DIR, exist_ok=True)

    gerados = []
    for entry in npcs:
        npc_id = entry["id"]
        builder = NPC_BUILDERS.get(npc_id)
        if builder is None:
            print(f"aviso: nenhum builder definido para {npc_id}, pulando")
            continue
        portrait = builder()
        out_name = entry.get("sprite") or f"{npc_id}.png"
        out_path = os.path.join(SPRITES_DIR, out_name)
        ga.save(portrait, out_path)
        gerados.append(out_name)

    print(f"retratos de NPC ok: {len(gerados)} arquivos em {SPRITES_DIR}")
    return gerados


if __name__ == "__main__":
    build_npc_art()
