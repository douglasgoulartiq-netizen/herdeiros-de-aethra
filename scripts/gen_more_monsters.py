#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera os sprites dos 16 monstros novos da task #48 (mais monstros pra
enciclopédia/bestiário), reaproveitando os helpers de pixel art de
gen_assets.py (canvas/px/rect/outline_shape/upscale NEAREST) — mesmo
estilo visual dos monstros originais e da expansão anterior.
"""
import os
from PIL import Image

from gen_assets import (
    GRID, UPSCALE, SPRITES_DIR, canvas, px, rect, outline_shape,
)


def monster_rato_gigante():
    img = canvas()
    rect(img, 2, 9, 12, 13, (120, 108, 96, 255))
    rect(img, 9, 6, 14, 10, (134, 122, 108, 255))
    px(img, 13, 7, (20, 20, 20, 255))
    rect(img, 3, 5, 5, 8, (230, 190, 190, 255))
    rect(img, 6, 4, 8, 7, (230, 190, 190, 255))
    rect(img, 1, 11, 2, 12, (220, 190, 190, 255))
    outline_shape(img)
    return img


def monster_abelha_titan():
    img = canvas()
    rect(img, 4, 6, 12, 11, (240, 200, 40, 255))
    rect(img, 4, 7, 5, 10, (30, 24, 16, 255))
    rect(img, 7, 7, 8, 10, (30, 24, 16, 255))
    rect(img, 10, 7, 11, 10, (30, 24, 16, 255))
    rect(img, 1, 4, 5, 7, (200, 230, 240, 140))
    rect(img, 8, 3, 12, 6, (200, 230, 240, 140))
    px(img, 5, 7, (20, 20, 20, 255))
    px(img, 12, 9, (60, 40, 20, 255))
    outline_shape(img)
    return img


def monster_corvo_ceifador():
    img = canvas()
    rect(img, 6, 6, 10, 12, (30, 24, 34, 255))
    rect(img, 0, 3, 6, 9, (44, 36, 50, 255))
    rect(img, 10, 3, 16, 9, (44, 36, 50, 255))
    rect(img, 5, 2, 11, 6, (58, 48, 66, 255))
    px(img, 6, 4, (150, 40, 60, 255))
    px(img, 9, 4, (150, 40, 60, 255))
    rect(img, 7, 12, 8, 14, (200, 170, 40, 255))
    outline_shape(img)
    return img


def monster_cristal_ecoante():
    img = canvas()
    rect(img, 4, 10, 12, 14, (60, 52, 44, 255))
    rect(img, 5, 3, 11, 10, (90, 200, 220, 200))
    rect(img, 6, 1, 10, 4, (140, 230, 240, 220))
    px(img, 8, 5, (230, 255, 255, 255))
    px(img, 7, 8, (230, 255, 255, 255))
    px(img, 9, 9, (230, 255, 255, 255))
    outline_shape(img)
    return img


def monster_wisp_radiante():
    img = canvas()
    for (x, y) in [(7, 7), (8, 7), (7, 8), (8, 8), (6, 8), (9, 8), (7, 9), (8, 9)]:
        px(img, x, y, (255, 240, 170, 255))
    for (x, y) in [(5, 6), (10, 6), (5, 10), (10, 10), (4, 8), (11, 8)]:
        px(img, x, y, (255, 250, 210, 130))
    px(img, 7, 8, (255, 255, 255, 255))
    outline_shape(img)
    return img


def monster_sentinela_dourada():
    img = canvas()
    rect(img, 4, 8, 11, 14, (200, 170, 60, 255))
    rect(img, 5, 4, 10, 8, (220, 190, 80, 255))
    rect(img, 6, 2, 9, 4, (240, 210, 110, 255))
    px(img, 7, 3, (255, 250, 200, 255))
    px(img, 8, 3, (255, 250, 200, 255))
    rect(img, 2, 9, 4, 12, (170, 140, 40, 255))
    rect(img, 11, 9, 13, 12, (170, 140, 40, 255))
    outline_shape(img)
    return img


def monster_gralha_tempestuosa():
    img = canvas()
    rect(img, 6, 6, 10, 11, (26, 30, 40, 255))
    rect(img, 0, 4, 6, 9, (36, 42, 56, 255))
    rect(img, 10, 4, 16, 9, (36, 42, 56, 255))
    rect(img, 5, 3, 11, 6, (46, 54, 70, 255))
    px(img, 6, 4, (140, 200, 255, 255))
    px(img, 9, 4, (140, 200, 255, 255))
    rect(img, 7, 11, 8, 13, (200, 170, 40, 255))
    outline_shape(img)
    return img


def monster_verme_das_dunas():
    img = canvas()
    rect(img, 3, 9, 13, 13, (196, 158, 96, 255))
    rect(img, 5, 6, 11, 9, (210, 174, 110, 255))
    rect(img, 6, 3, 10, 6, (222, 188, 126, 255))
    px(img, 7, 4, (30, 20, 10, 255))
    px(img, 9, 4, (30, 20, 10, 255))
    for x in range(4, 12, 2):
        px(img, x, 11, (160, 126, 70, 255))
    outline_shape(img)
    return img


def monster_arraia_relampago():
    img = canvas()
    rect(img, 4, 6, 11, 10, (60, 90, 150, 255))
    rect(img, 0, 5, 4, 8, (70, 100, 165, 255))
    rect(img, 11, 5, 15, 8, (70, 100, 165, 255))
    px(img, 8, 7, (240, 240, 100, 255))
    rect(img, 6, 10, 9, 14, (50, 78, 130, 255))
    px(img, 5, 6, (255, 255, 150, 255))
    px(img, 10, 9, (255, 255, 150, 255))
    outline_shape(img)
    return img


def monster_enguia_eletrica():
    img = canvas()
    rect(img, 1, 9, 13, 11, (50, 130, 150, 255))
    rect(img, 12, 8, 15, 12, (60, 145, 165, 255))
    px(img, 13, 9, (20, 20, 20, 255))
    for x in range(2, 12, 3):
        px(img, x, 8, (240, 240, 120, 255))
        px(img, x + 1, 12, (240, 240, 120, 255))
    outline_shape(img)
    return img


def monster_sentinela_arcana():
    img = canvas()
    rect(img, 5, 9, 10, 14, (70, 60, 90, 255))
    rect(img, 4, 4, 11, 9, (120, 90, 190, 220))
    rect(img, 6, 1, 9, 4, (150, 120, 220, 240))
    px(img, 7, 6, (230, 200, 255, 255))
    px(img, 8, 6, (230, 200, 255, 255))
    px(img, 6, 8, (200, 160, 250, 255))
    px(img, 9, 8, (200, 160, 250, 255))
    outline_shape(img)
    return img


def monster_espectro_arcano():
    img = canvas()
    rect(img, 5, 3, 10, 11, (150, 110, 220, 150))
    rect(img, 6, 12, 9, 14, (150, 110, 220, 110))
    px(img, 6, 6, (240, 220, 255, 255))
    px(img, 9, 6, (240, 220, 255, 255))
    px(img, 7, 9, (200, 160, 250, 200))
    px(img, 8, 9, (200, 160, 250, 200))
    outline_shape(img)
    return img


def monster_lobo_gelido():
    img = canvas()
    rect(img, 2, 8, 13, 13, (200, 230, 240, 255))
    rect(img, 9, 4, 14, 9, (215, 240, 248, 255))
    rect(img, 12, 3, 13, 4, (215, 240, 248, 255))
    rect(img, 14, 4, 15, 5, (215, 240, 248, 255))
    px(img, 13, 6, (80, 170, 220, 255))
    px(img, 12, 6, (80, 170, 220, 255))
    rect(img, 2, 13, 4, 15, (170, 210, 225, 255))
    rect(img, 10, 13, 12, 15, (170, 210, 225, 255))
    outline_shape(img)
    return img


def monster_bruxa_da_bruma():
    img = canvas()
    rect(img, 5, 9, 10, 14, (60, 70, 90, 255))
    rect(img, 4, 4, 11, 9, (90, 100, 120, 255))
    rect(img, 3, 1, 12, 5, (50, 58, 78, 255))
    px(img, 6, 6, (170, 220, 240, 255))
    px(img, 9, 6, (170, 220, 240, 255))
    rect(img, 2, 6, 3, 9, (140, 190, 220, 200))
    rect(img, 12, 6, 13, 9, (140, 190, 220, 200))
    outline_shape(img)
    return img


def monster_construto_arcano():
    img = canvas()
    rect(img, 2, 6, 13, 14, (80, 76, 88, 255))
    rect(img, 4, 2, 11, 6, (96, 92, 106, 255))
    rect(img, 1, 8, 2, 12, (70, 66, 78, 255))
    rect(img, 13, 8, 14, 12, (70, 66, 78, 255))
    px(img, 6, 4, (180, 140, 250, 255))
    px(img, 9, 4, (180, 140, 250, 255))
    px(img, 7, 9, (180, 140, 250, 255))
    px(img, 8, 9, (180, 140, 250, 255))
    outline_shape(img)
    return img


def monster_carrasco_de_cinzas():
    img = canvas()
    rect(img, 3, 6, 12, 14, (40, 34, 36, 255))
    rect(img, 5, 2, 10, 6, (56, 48, 50, 255))
    px(img, 6, 4, (250, 140, 40, 255))
    px(img, 9, 4, (250, 140, 40, 255))
    rect(img, 1, 5, 3, 12, (30, 24, 26, 255))
    rect(img, 12, 3, 14, 13, (200, 90, 30, 255))
    for x in range(4, 12, 2):
        px(img, x, 7, (250, 140, 40, 255))
    outline_shape(img)
    return img


MONSTER_BUILDERS = {
    "rato_gigante": monster_rato_gigante,
    "abelha_titan": monster_abelha_titan,
    "corvo_ceifador": monster_corvo_ceifador,
    "cristal_ecoante": monster_cristal_ecoante,
    "wisp_radiante": monster_wisp_radiante,
    "sentinela_dourada": monster_sentinela_dourada,
    "gralha_tempestuosa": monster_gralha_tempestuosa,
    "verme_das_dunas": monster_verme_das_dunas,
    "arraia_relampago": monster_arraia_relampago,
    "enguia_eletrica": monster_enguia_eletrica,
    "sentinela_arcana": monster_sentinela_arcana,
    "espectro_arcano": monster_espectro_arcano,
    "lobo_gelido": monster_lobo_gelido,
    "bruxa_da_bruma": monster_bruxa_da_bruma,
    "construto_arcano": monster_construto_arcano,
    "carrasco_de_cinzas": monster_carrasco_de_cinzas,
}


def build_more_monsters():
    for name, fn in MONSTER_BUILDERS.items():
        frame1 = fn()
        frame2 = frame1.transform((GRID, GRID), Image.AFFINE, (1, 0, 0, 0, 1, -1), resample=Image.NEAREST)
        sheet = Image.new("RGBA", (GRID * 2, GRID), (0, 0, 0, 0))
        sheet.paste(frame1, (0, 0))
        sheet.paste(frame2, (GRID, 0))
        big = sheet.resize((GRID * 2 * UPSCALE, GRID * UPSCALE), Image.NEAREST)
        big.save(os.path.join(SPRITES_DIR, f"mob_{name}.png"))
    print("monstros novos (task #48) ok:", list(MONSTER_BUILDERS.keys()))


if __name__ == "__main__":
    build_more_monsters()
    print("BESTIARIO EXPANDIDO PRONTO")
