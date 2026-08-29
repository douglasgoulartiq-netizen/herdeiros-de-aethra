#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de retratos (portraits) para o elenco de invocacao (gacha) do RPG.

Reaproveita a mesma maquinaria de "palette-swap" usada em gen_assets.py
(paletas de raca, estilos de classe, desenho parametrizado do humanoide e
overlay de arma) para manter o retrato visualmente consistente com os
sprites de personagem ja existentes em assets/sprites/pc_<raca>_<classe>.png.

Cada personagem do elenco recebe pequenas variacoes de silhueta (estilo de
cabelo) e um acento de cor combinando o acento da classe com a cor da sua
raridade, alem de uma marca de raridade no canto do retrato, para que nao
fiquem 100% identicos entre si nem identicos ao sprite padrao do jogador
para a mesma combinacao raca+classe.

Uso:
    python3 scripts/gen_gacha_roster_art.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)

# Reaproveita funcoes/paletas/constantes do gerador de assets original em
# vez de reinventar o desenho pixel a pixel.
import gen_assets as ga  # noqa: E402

SPRITES_DIR = ga.SPRITES_DIR  # assets/sprites/ -- mesma pasta dos pc_*.png
ROSTER_PATH = os.path.join(ROOT, "src", "data", "gachaRoster.json")

RARITY_COLOR = {
    "comum":    (170, 170, 176, 255),
    "incomum":  (70, 180, 96, 255),
    "raro":     (64, 122, 224, 255),
    "epico":    (176, 70, 224, 255),
    "lendario": (230, 180, 40, 255),
}


def blend(c1, c2, t):
    """Mistura duas cores RGBA; t=0 -> c1, t=1 -> c2."""
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3)) + (255,)


def add_hair_variant(img, hair, variant):
    """Pequena variacao de silhueta de cabelo para diferenciar personagens
    que compartilham raca+classe com o sprite padrao do jogador (ou entre
    si), sem fugir da grade 16x16 nem do estilo do jogo."""
    if variant == 1:
        # topete/moicano: tufo central acima da cabeca
        ga.px(img, 7, 0, hair)
        ga.px(img, 8, 0, hair)
    elif variant == 2:
        # mecha lateral longa
        ga.px(img, 4, 3, hair)
        ga.px(img, 4, 4, hair)
        ga.px(img, 4, 5, hair)
    # variant == 0: mantem o corte padrao desenhado por draw_humanoid()
    return img


def add_rarity_mark(img, cor):
    """Marca discreta de raridade no canto superior direito do retrato."""
    ga.px(img, 14, 0, cor)
    ga.px(img, 15, 0, cor)
    ga.px(img, 15, 1, cor)


def build_portrait(entry, variant):
    raca = entry["racaId"]
    classe = entry["classeId"]
    raridade = entry["raridade"]

    rp = ga.RACE_PALETTES[raca]
    cs = ga.CLASS_STYLE[classe]
    rarity_color = RARITY_COLOR[raridade]

    # acento da classe levemente tingido pela cor de raridade, para nao ficar
    # identico ao acento puro usado no sprite padrao pc_<raca>_<classe>.png
    accent = blend(cs["accent"], rarity_color, 0.3)

    base = ga.draw_humanoid(rp["skin"], rp["hair"], cs["armor"], cs["armor2"], accent, pose="idle")
    add_hair_variant(base, rp["hair"], variant)

    weapon = ga.draw_weapon_overlay(cs["weapon"], accent)
    frame = ga.Image.alpha_composite(base, weapon)

    add_rarity_mark(frame, rarity_color)
    return frame


def build_roster_art():
    with open(ROSTER_PATH, "r", encoding="utf-8") as f:
        roster = json.load(f)

    os.makedirs(SPRITES_DIR, exist_ok=True)

    gerados = []
    for i, entry in enumerate(roster):
        variant = i % 3
        portrait = build_portrait(entry, variant)
        out_name = entry.get("sprite") or f"gacha_{entry['id']}.png"
        out_path = os.path.join(SPRITES_DIR, out_name)
        ga.save(portrait, out_path)
        gerados.append(out_name)

    print(f"retratos do elenco de invocacao ok: {len(gerados)} arquivos em {SPRITES_DIR}")
    return gerados


if __name__ == "__main__":
    build_roster_art()
