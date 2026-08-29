#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de pixel art "HD" (task de UX Combate/Mitologia: "melhorando a parte
visual com pixel art de mais detalhes"). Não é geração de imagem por IA —
não há essa ferramenta neste ambiente — é uma evolução do motor procedural
já usado no jogo (gen_assets.py), inspirada na COMPOSIÇÃO do print de
referência que o usuário mandou (proporção chibi cabeça grande/corpo
pequeno, sombreamento em blocos, silhueta legível a distância):

  - grade 32x32 em vez de 16x16 (4x mais pixels que o motor original)
  - sombreamento de 3 tons por região (base/luz/sombra) em vez de cor lisa
  - proporção chibi (cabeça grande) como no print de referência
  - olhos com brilho, sobrancelha, sombra de queixo — rosto legível de perto

Reaproveita as MESMAS paletas de raça/classe do motor original
(RACE_PALETTES/CLASS_STYLE em gen_assets.py), então uma raça+classe olha
"a mesma pessoa, mais detalhada" — não uma paleta nova desencontrada.

Escopo (ver 100_melhorias / changelog da rodada de mitologia): gera um
CONJUNTO REPRESENTATIVO — retratos das 6 raças x 6 classes do herói, mais
os 9 monstros-base já modelados em gen_assets.py — como prova de conceito
pro novo layout de batalha (barra de retratos). Não substitui os +100
sprites do gacha nem o bestiário inteiro: regenerar tudo nesse nível de
detalhe é um projeto à parte, avaliado e adiado por escopo (ver changelog).
"""
import os
from PIL import Image, ImageDraw

from gen_assets import RACE_PALETTES, CLASS_STYLE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD_DIR = os.path.join(ROOT, "assets", "sprites_hd")
os.makedirs(HD_DIR, exist_ok=True)

GRID = 32
UPSCALE = 4
OUT = GRID * UPSCALE
OUTLINE = (18, 15, 14, 255)


def canvas():
    return Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))


def shade(color, delta):
    r, g, b, a = color
    return (max(0, min(255, r + delta)), max(0, min(255, g + delta)), max(0, min(255, b + delta)), a)


def rect(img, x0, y0, x1, y1, color):
    ImageDraw.Draw(img).rectangle([x0, y0, x1, y1], fill=color)


def px(img, x, y, color):
    if 0 <= x < GRID and 0 <= y < GRID:
        img.putpixel((x, y), color)


def shaded_block(img, x0, y0, x1, y1, base, light_edge="top", shadow_edge="bottom"):
    """Preenche um bloco com cor base e acrescenta uma tira de luz e uma de
    sombra nas bordas indicadas — o "sombreamento em blocos" que dá volume
    sem precisar de um pincel de verdade."""
    rect(img, x0, y0, x1, y1, base)
    light = shade(base, 38)
    dark = shade(base, -34)
    if light_edge == "top":
        rect(img, x0, y0, x1, y0, light)
    elif light_edge == "left":
        rect(img, x0, y0, x0, y1, light)
    if shadow_edge == "bottom":
        rect(img, x0, y1, x1, y1, dark)
    elif shadow_edge == "right":
        rect(img, x1, y0, x1, y1, dark)


def outline_shape(img, color=OUTLINE):
    w, h = img.size
    src = img.copy()
    for y in range(h):
        for x in range(w):
            if src.getpixel((x, y))[3] == 0:
                neigh = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] != 0:
                        neigh = True
                        break
                if neigh:
                    img.putpixel((x, y), color)


def save(img, path, out=OUT):
    big = img.resize((out, out), Image.NEAREST)
    big.save(path)


WEAPON_HD = {
    "sword": {"metal": (205, 205, 214, 255), "wood": (98, 66, 36, 255)},
    "staff": {"metal": (110, 74, 40, 255), "wood": (110, 74, 40, 255)},
    "dagger": {"metal": (205, 205, 214, 255), "wood": (72, 48, 24, 255)},
    "mace": {"metal": (110, 74, 40, 255), "wood": (110, 74, 40, 255)},
    "axe": {"metal": (205, 205, 214, 255), "wood": (110, 74, 40, 255)},
    "bow": {"metal": (110, 74, 40, 255), "wood": (110, 74, 40, 255)},
}


def draw_portrait(skin, hair, armor, armor2, accent, weapon):
    """Retrato busto (proporção chibi: cabeça grande) — pensado pra barra de
    retratos no topo da tela de batalha, não pro sprite de corpo inteiro
    usado no mapa (esse continua vindo do motor 16x16 original, que não foi
    tocado)."""
    img = canvas()

    # ombros / torso (parte de baixo do retrato)
    shaded_block(img, 6, 24, 25, 31, armor, light_edge="left", shadow_edge="bottom")
    shaded_block(img, 6, 24, 25, 25, armor2, light_edge="top", shadow_edge=None)
    rect(img, 14, 21, 17, 25, accent)  # gola/detalhe do peito

    # pescoco
    rect(img, 13, 18, 18, 22, shade(skin, -12))

    # cabeca grande (chibi) — ocupa quase metade do retrato
    shaded_block(img, 6, 3, 25, 20, skin, light_edge="left", shadow_edge="right")
    # sombra de queixo
    rect(img, 9, 19, 22, 20, shade(skin, -18))

    # cabelo (topo + laterais, mais volumoso que o motor original)
    rect(img, 5, 1, 26, 6, hair)
    rect(img, 5, 3, 8, 14, hair)
    rect(img, 23, 3, 26, 14, hair)
    rect(img, 5, 1, 26, 2, shade(hair, 30))

    # sobrancelhas
    rect(img, 10, 9, 13, 9, shade(skin, -60))
    rect(img, 18, 9, 21, 9, shade(skin, -60))

    # olhos (com brilho)
    rect(img, 10, 11, 13, 13, (28, 22, 20, 255))
    rect(img, 18, 11, 21, 13, (28, 22, 20, 255))
    px(img, 11, 11, (240, 240, 245, 255))
    px(img, 19, 11, (240, 240, 245, 255))

    # boca
    rect(img, 13, 16, 18, 16, shade(skin, -40))

    # capacete/acessorio de classe simples, sugerindo silhueta sem esconder o rosto
    rect(img, 5, 2, 26, 4, armor2)
    px(img, 15, 2, accent)
    px(img, 16, 2, accent)

    # arma encostada no ombro (silhueta reconhecível, mesma lista de armas do motor original)
    wp = WEAPON_HD.get(weapon, WEAPON_HD["sword"])
    if weapon == "staff" or weapon == "bow" or weapon == "mace" or weapon == "axe":
        rect(img, 27, 4, 28, 27, wp["wood"])
    if weapon == "sword":
        rect(img, 26, 4, 28, 18, wp["metal"])
        rect(img, 25, 18, 29, 20, (80, 54, 26, 255))
    elif weapon == "dagger":
        rect(img, 27, 10, 28, 18, wp["metal"])
    elif weapon == "axe":
        rect(img, 24, 3, 29, 9, wp["metal"])
    elif weapon == "bow":
        rect(img, 27, 3, 27, 27, wp["wood"])
        rect(img, 26, 6, 26, 24, wp["wood"])
    elif weapon == "mace":
        rect(img, 25, 2, 29, 6, accent)

    outline_shape(img)
    return img


MONSTER_HD_PALETTES = {
    "lobo":      {"body": (110, 110, 120, 255), "accent": (200, 200, 210, 255), "eye": (220, 60, 40, 255)},
    "goblin":    {"body": (110, 150, 80, 255),  "accent": (70, 100, 50, 255),   "eye": (240, 220, 60, 255)},
    "esqueleto": {"body": (222, 218, 200, 255), "accent": (180, 174, 150, 255), "eye": (80, 200, 220, 255)},
    "aranha":    {"body": (40, 34, 44, 255),    "accent": (90, 30, 90, 255),    "eye": (220, 40, 40, 255)},
    "slime":     {"body": (80, 200, 130, 255),  "accent": (50, 160, 100, 255),  "eye": (20, 40, 30, 255)},
    "orc":       {"body": (90, 130, 70, 255),   "accent": (60, 90, 45, 255),    "eye": (230, 60, 40, 255)},
    "morcego":   {"body": (60, 40, 70, 255),    "accent": (100, 70, 110, 255),  "eye": (230, 40, 90, 255)},
    "bandido":   {"body": (70, 60, 55, 255),    "accent": (130, 40, 40, 255),   "eye": (230, 230, 230, 255)},
    "dragao":    {"body": (170, 50, 50, 255),   "accent": (110, 24, 24, 255),   "eye": (255, 220, 60, 255)},
}


def draw_monster_portrait(nome, pal):
    img = canvas()
    body = pal["body"]
    accent = pal["accent"]
    eye = pal["eye"]

    # corpo largo (monstros ficam mais "musculosos"/robustos que os heróis)
    shaded_block(img, 4, 16, 27, 31, body, light_edge="left", shadow_edge="bottom")
    # cabeca grande
    shaded_block(img, 5, 2, 26, 20, body, light_edge="left", shadow_edge="right")
    # crista/orelha/chifre — silhueta única por monstro, ainda simples mas reconhecível
    if nome in ("lobo", "goblin", "orc"):
        rect(img, 3, 4, 6, 10, accent)
        rect(img, 25, 4, 28, 10, accent)
    elif nome == "esqueleto":
        rect(img, 5, 2, 26, 5, shade(body, 20))
    elif nome == "aranha":
        for i, dx in enumerate((2, 6, 24, 28)):
            rect(img, dx, 3, dx + 1, 10, accent)
    elif nome == "slime":
        rect(img, 5, 2, 26, 20, shade(body, 20))
    elif nome == "morcego":
        rect(img, 0, 2, 6, 6, accent)
        rect(img, 25, 2, 31, 6, accent)
    elif nome == "bandido":
        rect(img, 4, 3, 27, 8, (30, 26, 24, 255))  # capuz
    elif nome == "dragao":
        rect(img, 2, 3, 7, 9, accent)
        rect(img, 24, 3, 29, 9, accent)

    # olhos
    rect(img, 10, 10, 14, 13, eye)
    rect(img, 17, 10, 21, 13, eye)
    px(img, 11, 10, (255, 255, 255, 220))
    px(img, 18, 10, (255, 255, 255, 220))

    # boca/presas
    rect(img, 11, 16, 20, 17, shade(body, -50))
    px(img, 12, 17, (245, 245, 245, 255))
    px(img, 19, 17, (245, 245, 245, 255))

    outline_shape(img)
    return img


def build_hd_showcase():
    count = 0
    for race, rp in RACE_PALETTES.items():
        for cls, cs in CLASS_STYLE.items():
            img = draw_portrait(rp["skin"], rp["hair"], cs["armor"], cs["armor2"], cs["accent"], cs["weapon"])
            save(img, os.path.join(HD_DIR, f"retrato_{race}_{cls}.png"))
            count += 1
    print("retratos HD de heroi ok:", count)

    count_m = 0
    for nome, pal in MONSTER_HD_PALETTES.items():
        img = draw_monster_portrait(nome, pal)
        save(img, os.path.join(HD_DIR, f"retrato_monstro_{nome}.png"))
        count_m += 1
    print("retratos HD de monstro ok:", count_m)


if __name__ == "__main__":
    build_hd_showcase()
    print("HD SHOWCASE PRONTO")
