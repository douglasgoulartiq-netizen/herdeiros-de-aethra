#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera os sprites dos 21 chefes obrigatórios de zona da task #45, reaproveitando
os helpers de pixel art de gen_assets.py — mesmo estilo visual dos monstros
comuns, mas com paleta mais elaborada/imponente (chefes são maiores/mais
ricos em detalhe que monstros comuns, na medida do possível num grid 16x16).
"""
import os
from PIL import Image

from gen_assets import (
    GRID, UPSCALE, SPRITES_DIR, canvas, px, rect, outline_shape,
)


def _quadruped(cor_corpo, cor_detalhe, cor_olho):
    img = canvas()
    rect(img, 2, 8, 13, 14, cor_corpo)
    rect(img, 9, 4, 15, 10, cor_detalhe)
    px(img, 13, 6, cor_olho)
    px(img, 12, 6, cor_olho)
    rect(img, 1, 13, 3, 15, cor_corpo)
    rect(img, 10, 13, 12, 15, cor_corpo)
    outline_shape(img)
    return img


def _humanoide(cor_corpo, cor_armadura, cor_olho, cor_extra=None):
    img = canvas()
    rect(img, 4, 8, 11, 15, cor_corpo)
    rect(img, 5, 3, 10, 8, cor_armadura)
    rect(img, 6, 1, 9, 3, cor_armadura)
    px(img, 7, 4, cor_olho)
    px(img, 8, 4, cor_olho)
    if cor_extra:
        rect(img, 2, 8, 3, 13, cor_extra)
        rect(img, 12, 8, 13, 13, cor_extra)
    outline_shape(img)
    return img


def boss_guardiao_das_raizes():
    return _humanoide((70, 100, 60, 255), (50, 80, 40, 255), (200, 240, 100, 255), (90, 60, 30, 255))


def boss_devoradora_de_sombras():
    return _quadruped((26, 20, 36, 255), (40, 30, 54, 255), (200, 40, 220, 255))


def boss_paladino_do_sol_poente():
    return _humanoide((220, 190, 120, 255), (250, 220, 150, 255), (255, 255, 220, 255), (230, 200, 60, 255))


def boss_bruxa_do_lodo_eterno():
    return _humanoide((60, 90, 40, 255), (40, 70, 30, 255), (150, 230, 40, 255))


def boss_capita_mare_negra():
    return _humanoide((30, 40, 50, 255), (20, 60, 80, 255), (200, 230, 255, 255), (140, 100, 40, 255))


def boss_tirano_do_charco():
    img = canvas()
    rect(img, 2, 6, 13, 15, (40, 60, 30, 255))
    rect(img, 4, 3, 11, 7, (60, 90, 40, 255))
    px(img, 6, 5, (200, 240, 60, 255))
    px(img, 9, 5, (200, 240, 60, 255))
    for (x, y) in [(3, 9), (12, 10), (6, 13), (10, 8)]:
        px(img, x, y, (20, 30, 15, 255))
    outline_shape(img)
    return img


def boss_colosso_das_pedras_cinzentas():
    img = canvas()
    rect(img, 1, 5, 14, 15, (100, 98, 100, 255))
    rect(img, 3, 2, 12, 6, (120, 118, 120, 255))
    px(img, 6, 4, (200, 220, 240, 255))
    px(img, 9, 4, (200, 220, 240, 255))
    rect(img, 0, 8, 2, 13, (80, 78, 80, 255))
    rect(img, 13, 8, 15, 13, (80, 78, 80, 255))
    outline_shape(img)
    return img


def boss_matriarca_ursina():
    return _quadruped((90, 62, 40, 255), (110, 80, 54, 255), (240, 60, 40, 255))


def boss_grifo_alfa_dos_ventos():
    img = canvas()
    rect(img, 6, 6, 10, 12, (200, 170, 100, 255))
    rect(img, 0, 3, 6, 9, (150, 120, 80, 255))
    rect(img, 10, 3, 16, 9, (150, 120, 80, 255))
    rect(img, 5, 1, 11, 5, (100, 70, 50, 255))
    px(img, 6, 3, (255, 220, 40, 255))
    px(img, 9, 3, (255, 220, 40, 255))
    rect(img, 6, 12, 7, 15, (220, 190, 40, 255))
    rect(img, 9, 12, 10, 15, (220, 190, 40, 255))
    outline_shape(img)
    return img


def boss_rainha_escorpiao_de_karn():
    img = canvas()
    rect(img, 2, 9, 13, 13, (200, 100, 40, 255))
    rect(img, 4, 6, 11, 9, (220, 120, 50, 255))
    px(img, 6, 7, (20, 20, 20, 255))
    px(img, 9, 7, (20, 20, 20, 255))
    rect(img, 11, 3, 14, 7, (180, 90, 35, 255))
    px(img, 13, 3, (255, 220, 100, 255))
    outline_shape(img)
    return img


def boss_serpente_da_tempestade_eterna():
    img = canvas()
    rect(img, 1, 9, 13, 11, (60, 80, 160, 255))
    rect(img, 12, 7, 15, 12, (70, 95, 180, 255))
    px(img, 13, 9, (20, 20, 20, 255))
    for x in range(2, 12, 3):
        px(img, x, 7, (250, 250, 140, 255))
        px(img, x + 1, 13, (250, 250, 140, 255))
    outline_shape(img)
    return img


def boss_cavaleiro_caido_de_aethra():
    return _humanoide((60, 58, 66, 255), (80, 78, 90, 255), (140, 40, 220, 255), (50, 48, 56, 255))


def boss_troll_anciao_do_eco():
    return _quadruped((70, 90, 70, 255), (90, 110, 90, 255), (240, 220, 60, 255))


def boss_guardiao_arcano_das_ruinas():
    img = canvas()
    rect(img, 4, 9, 11, 15, (80, 70, 100, 255))
    rect(img, 3, 3, 12, 9, (140, 100, 210, 220))
    rect(img, 5, 0, 10, 3, (170, 130, 230, 240))
    px(img, 6, 6, (240, 210, 255, 255))
    px(img, 9, 6, (240, 210, 255, 255))
    outline_shape(img)
    return img


def boss_rei_petrificado():
    img = canvas()
    rect(img, 3, 8, 12, 15, (140, 140, 148, 255))
    rect(img, 4, 3, 11, 8, (155, 155, 162, 255))
    rect(img, 5, 0, 10, 3, (210, 180, 60, 255))
    px(img, 6, 5, (60, 60, 66, 255))
    px(img, 9, 5, (60, 60, 66, 255))
    outline_shape(img)
    return img


def boss_senhor_das_chamas_errantes():
    img = canvas()
    rect(img, 3, 6, 12, 15, (36, 30, 32, 255))
    rect(img, 5, 2, 10, 6, (50, 42, 44, 255))
    px(img, 6, 4, (255, 150, 30, 255))
    px(img, 9, 4, (255, 150, 30, 255))
    rect(img, 0, 4, 3, 13, (255, 120, 20, 255))
    rect(img, 12, 3, 15, 14, (255, 160, 40, 255))
    for x in range(4, 12, 2):
        px(img, x, 7, (255, 190, 60, 255))
    outline_shape(img)
    return img


def boss_matriarca_wyvern_das_falesias():
    img = canvas()
    rect(img, 6, 6, 10, 12, (150, 40, 50, 255))
    rect(img, 0, 3, 6, 9, (170, 55, 65, 255))
    rect(img, 10, 3, 16, 9, (170, 55, 65, 255))
    rect(img, 5, 1, 11, 5, (110, 30, 40, 255))
    px(img, 6, 3, (255, 220, 40, 255))
    px(img, 9, 3, (255, 220, 40, 255))
    rect(img, 6, 12, 7, 15, (90, 20, 30, 255))
    rect(img, 9, 12, 10, 15, (90, 20, 30, 255))
    outline_shape(img)
    return img


def boss_matriarca_da_bruma_eterna():
    img = canvas()
    rect(img, 5, 9, 10, 15, (90, 100, 120, 255))
    rect(img, 4, 4, 11, 9, (110, 120, 140, 255))
    rect(img, 3, 1, 12, 5, (70, 80, 100, 255))
    px(img, 6, 6, (200, 240, 255, 255))
    px(img, 9, 6, (200, 240, 255, 255))
    rect(img, 1, 5, 3, 11, (180, 220, 240, 160))
    rect(img, 12, 5, 14, 11, (180, 220, 240, 160))
    outline_shape(img)
    return img


def boss_senhor_sombrio_da_montanha():
    return _humanoide((30, 22, 40, 255), (44, 32, 58, 255), (255, 40, 60, 255), (20, 14, 30, 255))


def boss_dragao_anciao_das_cinzas():
    img = canvas()
    rect(img, 1, 8, 14, 14, (90, 40, 30, 255))
    rect(img, 8, 3, 15, 9, (110, 50, 38, 255))
    rect(img, 12, 2, 14, 4, (110, 50, 38, 255))
    rect(img, 15, 3, 16, 5, (110, 50, 38, 255))
    px(img, 13, 5, (255, 200, 40, 255))
    px(img, 12, 5, (255, 200, 40, 255))
    rect(img, 1, 13, 3, 15, (70, 30, 22, 255))
    rect(img, 10, 13, 12, 15, (70, 30, 22, 255))
    outline_shape(img)
    return img


def boss_imperador_arcano_dos_confins():
    img = canvas()
    rect(img, 4, 9, 11, 15, (60, 30, 90, 255))
    rect(img, 3, 3, 12, 9, (100, 50, 150, 230))
    rect(img, 4, 0, 11, 3, (230, 200, 255, 255))
    px(img, 6, 6, (255, 240, 200, 255))
    px(img, 9, 6, (255, 240, 200, 255))
    rect(img, 1, 6, 3, 13, (150, 90, 210, 150))
    rect(img, 12, 6, 14, 13, (150, 90, 210, 150))
    outline_shape(img)
    return img


BOSS_BUILDERS = {
    "guardiao_das_raizes": boss_guardiao_das_raizes,
    "devoradora_de_sombras": boss_devoradora_de_sombras,
    "paladino_do_sol_poente": boss_paladino_do_sol_poente,
    "bruxa_do_lodo_eterno": boss_bruxa_do_lodo_eterno,
    "capita_mare_negra": boss_capita_mare_negra,
    "tirano_do_charco": boss_tirano_do_charco,
    "colosso_das_pedras_cinzentas": boss_colosso_das_pedras_cinzentas,
    "matriarca_ursina": boss_matriarca_ursina,
    "grifo_alfa_dos_ventos": boss_grifo_alfa_dos_ventos,
    "rainha_escorpiao_de_karn": boss_rainha_escorpiao_de_karn,
    "serpente_da_tempestade_eterna": boss_serpente_da_tempestade_eterna,
    "cavaleiro_caido_de_aethra": boss_cavaleiro_caido_de_aethra,
    "troll_anciao_do_eco": boss_troll_anciao_do_eco,
    "guardiao_arcano_das_ruinas": boss_guardiao_arcano_das_ruinas,
    "rei_petrificado": boss_rei_petrificado,
    "senhor_das_chamas_errantes": boss_senhor_das_chamas_errantes,
    "matriarca_wyvern_das_falesias": boss_matriarca_wyvern_das_falesias,
    "matriarca_da_bruma_eterna": boss_matriarca_da_bruma_eterna,
    "senhor_sombrio_da_montanha": boss_senhor_sombrio_da_montanha,
    "dragao_anciao_das_cinzas": boss_dragao_anciao_das_cinzas,
    "imperador_arcano_dos_confins": boss_imperador_arcano_dos_confins,
}


def build_zone_boss_sprites():
    for name, fn in BOSS_BUILDERS.items():
        frame1 = fn()
        frame2 = frame1.transform((GRID, GRID), Image.AFFINE, (1, 0, 0, 0, 1, -1), resample=Image.NEAREST)
        sheet = Image.new("RGBA", (GRID * 2, GRID), (0, 0, 0, 0))
        sheet.paste(frame1, (0, 0))
        sheet.paste(frame2, (GRID, 0))
        big = sheet.resize((GRID * 2 * UPSCALE, GRID * UPSCALE), Image.NEAREST)
        big.save(os.path.join(SPRITES_DIR, f"mob_{name}.png"))
    print("chefes de zona (task #45) ok:", list(BOSS_BUILDERS.keys()))


if __name__ == "__main__":
    build_zone_boss_sprites()
    print("SPRITES DOS CHEFES DE ZONA PRONTOS")
