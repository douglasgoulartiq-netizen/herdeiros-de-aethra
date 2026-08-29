#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera os sprites dos monstros novos da expansão de mundo (20 monstros,
niveis 2-16), reaproveitando os helpers de pixel art de gen_assets.py
(canvas/px/rect/outline_shape/salvamento com upscale NEAREST) para manter
o mesmo estilo visual dos monstros originais.
"""
import os
from PIL import Image

from gen_assets import (
    GRID, UPSCALE, SPRITES_DIR, canvas, px, rect, outline_shape,
)

# ---------------------------------------------------------------------------
# MONSTROS NOVOS (16x16, mesmo estilo dos monstros originais em gen_assets.py)
# ---------------------------------------------------------------------------
def monster_javali():
    img = canvas()
    rect(img, 2, 8, 12, 13, (110, 74, 46, 255))
    rect(img, 9, 5, 14, 10, (128, 88, 54, 255))
    rect(img, 13, 6, 15, 7, (230, 224, 210, 255))
    rect(img, 13, 8, 15, 9, (230, 224, 210, 255))
    px(img, 12, 7, (20, 20, 20, 255))
    rect(img, 3, 4, 7, 6, (90, 60, 36, 255))
    rect(img, 2, 13, 4, 15, (70, 46, 28, 255))
    rect(img, 9, 13, 11, 15, (70, 46, 28, 255))
    outline_shape(img)
    return img


def monster_lobo_sombrio():
    img = canvas()
    rect(img, 2, 8, 13, 13, (40, 32, 54, 255))
    rect(img, 9, 4, 14, 9, (52, 42, 68, 255))
    rect(img, 12, 3, 13, 4, (52, 42, 68, 255))
    rect(img, 14, 4, 15, 5, (52, 42, 68, 255))
    px(img, 13, 6, (170, 40, 220, 255))
    px(img, 12, 6, (170, 40, 220, 255))
    rect(img, 2, 13, 4, 15, (28, 22, 40, 255))
    rect(img, 10, 13, 12, 15, (28, 22, 40, 255))
    outline_shape(img)
    return img


def monster_sapo_venenoso():
    img = canvas()
    rect(img, 3, 8, 12, 14, (90, 150, 60, 255))
    rect(img, 4, 5, 7, 9, (110, 170, 70, 255))
    rect(img, 9, 5, 12, 9, (110, 170, 70, 255))
    px(img, 5, 6, (230, 230, 40, 255))
    px(img, 10, 6, (230, 230, 40, 255))
    px(img, 5, 7, (20, 20, 20, 255))
    px(img, 10, 7, (20, 20, 20, 255))
    for (x, y) in [(4, 10), (11, 11), (6, 12), (9, 9)]:
        px(img, x, y, (150, 90, 170, 255))
    rect(img, 4, 13, 6, 14, (70, 120, 44, 255))
    rect(img, 9, 13, 11, 14, (70, 120, 44, 255))
    outline_shape(img)
    return img


def monster_harpia():
    img = canvas()
    rect(img, 6, 6, 9, 11, (222, 176, 140, 255))
    rect(img, 0, 4, 6, 10, (140, 110, 70, 255))
    rect(img, 9, 4, 15, 10, (140, 110, 70, 255))
    rect(img, 5, 2, 10, 6, (90, 60, 40, 255))
    px(img, 6, 4, (230, 40, 40, 255))
    px(img, 9, 4, (230, 40, 40, 255))
    rect(img, 6, 11, 7, 14, (200, 170, 40, 255))
    rect(img, 8, 11, 9, 14, (200, 170, 40, 255))
    outline_shape(img)
    return img


def monster_touro_selvagem():
    img = canvas()
    rect(img, 3, 7, 12, 14, (110, 78, 48, 255))
    rect(img, 4, 3, 11, 8, (130, 96, 60, 255))
    rect(img, 1, 2, 4, 4, (230, 224, 210, 255))
    rect(img, 11, 2, 14, 4, (230, 224, 210, 255))
    px(img, 6, 5, (20, 20, 20, 255))
    px(img, 9, 5, (20, 20, 20, 255))
    rect(img, 6, 7, 9, 8, (40, 30, 20, 255))
    rect(img, 3, 13, 5, 15, (70, 50, 30, 255))
    rect(img, 10, 13, 12, 15, (70, 50, 30, 255))
    outline_shape(img)
    return img


def monster_lodo_negro():
    img = canvas()
    rect(img, 2, 9, 13, 14, (46, 30, 60, 255))
    rect(img, 3, 6, 12, 10, (60, 40, 78, 255))
    rect(img, 5, 4, 10, 7, (76, 52, 96, 255))
    px(img, 6, 9, (180, 100, 230, 255))
    px(img, 9, 9, (180, 100, 230, 255))
    rect(img, 4, 13, 11, 14, (30, 20, 42, 255))
    outline_shape(img)
    return img


def monster_caranguejo_gigante():
    img = canvas()
    rect(img, 3, 7, 12, 12, (196, 80, 40, 255))
    rect(img, 4, 5, 11, 7, (216, 100, 56, 255))
    rect(img, 0, 4, 3, 7, (216, 100, 56, 255))
    rect(img, 12, 4, 15, 7, (216, 100, 56, 255))
    px(img, 1, 3, (20, 20, 20, 255))
    px(img, 14, 3, (20, 20, 20, 255))
    rect(img, 2, 12, 4, 14, (160, 60, 30, 255))
    rect(img, 6, 12, 8, 14, (160, 60, 30, 255))
    rect(img, 11, 12, 13, 14, (160, 60, 30, 255))
    outline_shape(img)
    return img


def monster_urso_ancestral():
    img = canvas()
    rect(img, 2, 7, 13, 14, (96, 82, 62, 255))
    rect(img, 4, 3, 11, 8, (112, 98, 74, 255))
    rect(img, 3, 2, 5, 4, (112, 98, 74, 255))
    rect(img, 10, 2, 12, 4, (112, 98, 74, 255))
    px(img, 6, 5, (20, 20, 20, 255))
    px(img, 9, 5, (20, 20, 20, 255))
    for (x, y) in [(3, 8), (12, 9), (6, 12), (9, 6)]:
        px(img, x, y, (70, 130, 70, 255))
    rect(img, 2, 13, 5, 15, (70, 58, 42, 255))
    rect(img, 9, 13, 12, 15, (70, 58, 42, 255))
    outline_shape(img)
    return img


def monster_pirata_naufrago():
    img = canvas()
    rect(img, 4, 7, 11, 13, (60, 90, 100, 255))
    rect(img, 5, 3, 10, 8, (200, 178, 150, 255))
    rect(img, 4, 2, 11, 4, (40, 40, 44, 255))
    px(img, 6, 6, (20, 20, 20, 255))
    rect(img, 8, 5, 9, 6, (30, 30, 30, 255))
    rect(img, 5, 13, 6, 15, (40, 40, 44, 255))
    rect(img, 9, 13, 10, 15, (40, 40, 44, 255))
    rect(img, 12, 6, 13, 12, (150, 150, 155, 255))
    px(img, 3, 9, (150, 30, 30, 255))
    outline_shape(img)
    return img


def monster_druida_corrompido():
    img = canvas()
    rect(img, 4, 6, 11, 14, (60, 90, 60, 255))
    rect(img, 5, 3, 10, 7, (222, 176, 140, 255))
    rect(img, 4, 2, 11, 4, (46, 76, 46, 255))
    px(img, 6, 5, (170, 40, 220, 255))
    px(img, 9, 5, (170, 40, 220, 255))
    rect(img, 12, 1, 13, 12, (110, 74, 40, 255))
    rect(img, 10, 0, 15, 2, (140, 100, 60, 255))
    for (x, y) in [(6, 9), (9, 10), (7, 12)]:
        px(img, x, y, (120, 200, 120, 255))
    outline_shape(img)
    return img


def monster_escorpiao_gigante():
    img = canvas()
    rect(img, 3, 8, 11, 13, (196, 150, 40, 255))
    rect(img, 0, 8, 3, 10, (216, 170, 56, 255))
    rect(img, 11, 8, 14, 10, (216, 170, 56, 255))
    px(img, 1, 8, (20, 20, 20, 255))
    px(img, 13, 8, (20, 20, 20, 255))
    rect(img, 10, 4, 12, 8, (196, 150, 40, 255))
    rect(img, 12, 1, 14, 4, (196, 150, 40, 255))
    rect(img, 13, 0, 15, 2, (60, 40, 20, 255))
    rect(img, 3, 13, 5, 14, (150, 110, 20, 255))
    rect(img, 9, 13, 11, 14, (150, 110, 20, 255))
    outline_shape(img)
    return img


def monster_grifo_jovem():
    img = canvas()
    rect(img, 5, 8, 12, 14, (150, 118, 70, 255))
    rect(img, 5, 4, 10, 9, (222, 190, 140, 255))
    rect(img, 3, 2, 8, 5, (180, 150, 100, 255))
    rect(img, 2, 4, 4, 5, (222, 170, 40, 255))
    px(img, 6, 4, (20, 20, 20, 255))
    rect(img, 0, 6, 5, 12, (120, 96, 56, 255))
    rect(img, 5, 13, 6, 15, (200, 160, 40, 255))
    rect(img, 10, 13, 11, 15, (200, 160, 40, 255))
    outline_shape(img)
    return img


def monster_necromante_errante():
    img = canvas()
    rect(img, 4, 6, 11, 15, (40, 36, 54, 255))
    rect(img, 5, 3, 10, 7, (230, 228, 218, 255))
    rect(img, 4, 2, 11, 4, (26, 22, 36, 255))
    px(img, 6, 5, (150, 30, 230, 255))
    px(img, 9, 5, (150, 30, 230, 255))
    rect(img, 12, 1, 13, 13, (90, 60, 110, 255))
    rect(img, 10, 0, 15, 2, (150, 30, 230, 255))
    outline_shape(img)
    return img


def monster_serpente_marinha():
    img = canvas()
    rect(img, 2, 9, 13, 12, (40, 130, 150, 255))
    rect(img, 9, 4, 14, 9, (50, 150, 170, 255))
    rect(img, 12, 3, 14, 4, (50, 150, 170, 255))
    px(img, 12, 6, (230, 230, 40, 255))
    for (x, y) in [(3, 9), (6, 9), (9, 9)]:
        px(img, x, y, (20, 100, 118, 255))
    rect(img, 0, 10, 2, 11, (40, 130, 150, 255))
    outline_shape(img)
    return img


def monster_troll_das_cavernas():
    img = canvas()
    rect(img, 2, 6, 13, 14, (90, 110, 78, 255))
    rect(img, 4, 2, 11, 7, (100, 122, 88, 255))
    rect(img, 3, 3, 5, 4, (100, 122, 88, 255))
    rect(img, 10, 3, 12, 4, (100, 122, 88, 255))
    px(img, 6, 5, (200, 40, 40, 255))
    px(img, 9, 5, (200, 40, 40, 255))
    rect(img, 13, 1, 14, 13, (110, 74, 40, 255))
    rect(img, 12, 0, 15, 2, (90, 60, 30, 255))
    rect(img, 3, 13, 6, 15, (60, 46, 34, 255))
    rect(img, 9, 13, 12, 15, (60, 46, 34, 255))
    outline_shape(img)
    return img


def monster_golem_de_pedra():
    img = canvas()
    rect(img, 2, 5, 13, 14, (120, 118, 116, 255))
    rect(img, 4, 2, 11, 6, (132, 130, 128, 255))
    for (x, y) in [(3, 6), (10, 7), (6, 10), (9, 4)]:
        px(img, x, y, (96, 94, 92, 255))
    px(img, 7, 8, (100, 220, 230, 255))
    px(img, 8, 8, (100, 220, 230, 255))
    rect(img, 2, 13, 5, 15, (96, 94, 92, 255))
    rect(img, 10, 13, 13, 15, (96, 94, 92, 255))
    outline_shape(img)
    return img


def monster_gargula():
    img = canvas()
    rect(img, 3, 7, 12, 13, (110, 112, 118, 255))
    rect(img, 4, 3, 11, 8, (124, 126, 132, 255))
    rect(img, 0, 3, 4, 8, (96, 98, 104, 255))
    rect(img, 11, 3, 15, 8, (96, 98, 104, 255))
    rect(img, 5, 1, 6, 3, (200, 200, 205, 255))
    rect(img, 9, 1, 10, 3, (200, 200, 205, 255))
    px(img, 6, 5, (230, 60, 60, 255))
    px(img, 9, 5, (230, 60, 60, 255))
    rect(img, 4, 13, 6, 15, (86, 88, 94, 255))
    rect(img, 9, 13, 11, 15, (86, 88, 94, 255))
    outline_shape(img)
    return img


def monster_wyvern():
    img = canvas()
    rect(img, 3, 8, 12, 14, (60, 120, 70, 255))
    rect(img, 9, 4, 14, 9, (70, 140, 82, 255))
    rect(img, 13, 4, 15, 5, (70, 140, 82, 255))
    px(img, 12, 6, (230, 220, 40, 255))
    rect(img, 1, 9, 4, 13, (44, 96, 54, 255))
    rect(img, 11, 9, 14, 13, (44, 96, 54, 255))
    rect(img, 0, 12, 2, 15, (44, 96, 54, 255))
    for x in range(3, 12, 2):
        px(img, x, 8, (44, 96, 54, 255))
    outline_shape(img)
    return img


def monster_senhor_da_cinza():
    img = canvas()
    rect(img, 4, 6, 11, 15, (40, 32, 34, 255))
    rect(img, 5, 3, 10, 7, (60, 48, 50, 255))
    rect(img, 4, 2, 11, 4, (20, 16, 18, 255))
    px(img, 6, 5, (240, 120, 30, 255))
    px(img, 9, 5, (240, 120, 30, 255))
    rect(img, 12, 0, 13, 13, (120, 60, 20, 255))
    rect(img, 10, 0, 15, 1, (240, 120, 30, 255))
    for (x, y) in [(5, 9), (10, 10), (7, 12)]:
        px(img, x, y, (240, 120, 30, 255))
    outline_shape(img)
    return img


def monster_arauto_das_cinzas():
    img = canvas()
    rect(img, 3, 7, 12, 14, (50, 40, 42, 255))
    rect(img, 9, 3, 14, 8, (66, 54, 56, 255))
    rect(img, 13, 4, 15, 5, (66, 54, 56, 255))
    px(img, 12, 5, (250, 150, 40, 255))
    rect(img, 2, 9, 4, 12, (36, 28, 30, 255))
    rect(img, 11, 9, 13, 12, (36, 28, 30, 255))
    rect(img, 8, 1, 10, 3, (250, 150, 40, 255))
    for x in range(3, 12, 2):
        px(img, x, 7, (250, 150, 40, 255))
    outline_shape(img)
    return img


MONSTER_BUILDERS = {
    "javali": monster_javali,
    "lobo_sombrio": monster_lobo_sombrio,
    "sapo_venenoso": monster_sapo_venenoso,
    "harpia": monster_harpia,
    "touro_selvagem": monster_touro_selvagem,
    "lodo_negro": monster_lodo_negro,
    "caranguejo_gigante": monster_caranguejo_gigante,
    "urso_ancestral": monster_urso_ancestral,
    "pirata_naufrago": monster_pirata_naufrago,
    "druida_corrompido": monster_druida_corrompido,
    "escorpiao_gigante": monster_escorpiao_gigante,
    "grifo_jovem": monster_grifo_jovem,
    "necromante_errante": monster_necromante_errante,
    "serpente_marinha": monster_serpente_marinha,
    "troll_das_cavernas": monster_troll_das_cavernas,
    "golem_de_pedra": monster_golem_de_pedra,
    "gargula": monster_gargula,
    "wyvern": monster_wyvern,
    "senhor_da_cinza": monster_senhor_da_cinza,
    "arauto_das_cinzas": monster_arauto_das_cinzas,
}


def build_monsters_expansion():
    for name, fn in MONSTER_BUILDERS.items():
        frame1 = fn()
        frame2 = frame1.transform((GRID, GRID), Image.AFFINE, (1, 0, 0, 0, 1, -1), resample=Image.NEAREST)
        sheet = Image.new("RGBA", (GRID * 2, GRID), (0, 0, 0, 0))
        sheet.paste(frame1, (0, 0))
        sheet.paste(frame2, (GRID, 0))
        big = sheet.resize((GRID * 2 * UPSCALE, GRID * UPSCALE), Image.NEAREST)
        big.save(os.path.join(SPRITES_DIR, f"mob_{name}.png"))
    print("monstros da expansao ok:", list(MONSTER_BUILDERS.keys()))


if __name__ == "__main__":
    build_monsters_expansion()
    print("EXPANSAO DE ASSETS PRONTA")
