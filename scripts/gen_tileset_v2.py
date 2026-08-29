#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tileset v2 — pixel art com mais detalhe para o mundo aberto e vilarejos.
Substitui apenas assets/tiles/tileset.png (mantém sprites de personagens/
monstros/ícones do gen_assets.py original intactos).

Usa uma grade base de 32x32 (o dobro de detalhe do gerador original de
16x16) com upscale 2x -> 64x64 final, mantendo compatibilidade com
TILE_SIZE=64 usado em worldMap.js/Renderer.js.
"""
import os, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_DIR = os.path.join(ROOT, "assets", "tiles")
os.makedirs(TILES_DIR, exist_ok=True)

G = 32          # grade base
U = 2           # upscale
OUT = G * U      # 64

random.seed(7)

def canvas():
    return Image.new("RGBA", (G, G), (0, 0, 0, 0))

def px(img, x, y, color):
    if 0 <= x < G and 0 <= y < G:
        img.putpixel((x, y), color)

def rect(img, x0, y0, x1, y1, color):
    ImageDraw.Draw(img).rectangle([x0, y0, x1, y1], fill=color)

def noise_speckle(img, color, count, rng, avoid=None):
    for _ in range(count):
        x, y = rng.randrange(G), rng.randrange(G)
        if avoid and avoid(x, y):
            continue
        px(img, x, y, color)

def save(img, path):
    big = img.resize((OUT, OUT), Image.NEAREST)
    big.save(path)

TILE_NAMES = [
    "grass", "grass_detail", "path", "water", "tree", "wall_stone",
    "dungeon_floor", "dungeon_wall", "sand", "tall_grass", "village_floor", "bush",
]

# ---------------------------------------------------------------------------
def tile_grass(variant=False):
    img = canvas()
    base = (78, 148, 66, 255)
    shade = (64, 128, 54, 255)
    light = (96, 168, 80, 255)
    rect(img, 0, 0, G-1, G-1, base)
    rng = random.Random(1 if not variant else 2)
    # manchas de sombra orgânicas (blobs pequenos)
    for _ in range(10):
        cx, cy = rng.randrange(2, G-2), rng.randrange(2, G-2)
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if rng.random() < 0.55:
                    px(img, cx+dx, cy+dy, shade)
    # tufos de grama (linhas curtas verticais mais claras)
    for _ in range(14):
        x, y = rng.randrange(1, G-2), rng.randrange(1, G-3)
        px(img, x, y, light)
        px(img, x, y+1, light)
        px(img, x+1, y, base)
    if variant:
        # florzinhas
        for (x, y, c) in [(8,9,(230,120,150,255)),(22,14,(240,210,90,255)),(14,22,(230,120,150,255)),(26,6,(240,210,90,255))]:
            px(img, x, y, c)
            px(img, x+1, y, c)
            px(img, x, y+1, c)
            px(img, x+1, y+1, (255,255,255,120))
    return img

def tile_path():
    img = canvas()
    rect(img, 0, 0, G-1, G-1, (188, 156, 108, 255))
    rng = random.Random(3)
    # pedras irregulares de calçamento
    stones = []
    yy = 0
    row = 0
    while yy < G:
        xx = -4 if row % 2 else 0
        while xx < G:
            w = rng.randrange(6, 10)
            h = rng.randrange(6, 9)
            stones.append((xx, yy, xx+w, yy+h))
            xx += w + 1
        yy += h + 1
        row += 1
    for (x0, y0, x1, y1) in stones:
        tone = rng.choice([(178,146,98,255), (168,136,90,255), (198,166,116,255)])
        rect(img, max(0,x0), max(0,y0), min(G-1,x1), min(G-1,y1), tone)
        # contorno de argamassa
        ImageDraw.Draw(img).rectangle([max(0,x0), max(0,y0), min(G-1,x1), min(G-1,y1)], outline=(150,118,78,255))
    return img

def tile_water():
    img = canvas()
    deep = (46, 98, 168, 255)
    mid = (66, 128, 198, 255)
    light = (98, 168, 224, 255)
    foam = (200, 230, 245, 200)
    rect(img, 0, 0, G-1, G-1, deep)
    rng = random.Random(4)
    for band in range(0, G, 5):
        offset = (band // 5) % 2
        for x in range(-offset, G, 6):
            rect(img, x, band, min(x+4, G-1), band+1, mid)
    for _ in range(10):
        x = rng.randrange(0, G-4)
        y = rng.randrange(0, G-1)
        rect(img, x, y, min(x+3, G-1), y, light)
    for _ in range(4):
        x, y = rng.randrange(2, G-3), rng.randrange(2, G-3)
        px(img, x, y, foam)
        px(img, x+1, y, foam)
    return img

def tile_tree():
    img = canvas()
    trunk = (86, 56, 34, 255)
    trunk_d = (60, 38, 22, 255)
    c1 = (40, 96, 46, 255)
    c2 = (54, 116, 56, 255)
    c3 = (70, 138, 66, 255)
    rect(img, 13, 22, 19, 31, trunk)
    rect(img, 13, 22, 14, 31, trunk_d)
    ImageDraw.Draw(img).ellipse([2, 2, 29, 24], fill=c1)
    ImageDraw.Draw(img).ellipse([5, 0, 26, 18], fill=c2)
    rng = random.Random(5)
    for _ in range(16):
        x, y = rng.randrange(4, 27), rng.randrange(1, 20)
        if (x-16)**2 + (y-10)**2 < 150:
            px(img, x, y, c3)
    return img

def tile_wall_stone():
    img = canvas()
    mortar = (86, 84, 82, 255)
    rect(img, 0, 0, G-1, G-1, mortar)
    rng = random.Random(6)
    row_h = 6
    y = 0
    r = 0
    while y < G:
        off = -4 if r % 2 else 0
        x = off
        while x < G:
            w = rng.randrange(8, 12)
            tone = rng.choice([(132,130,126,255), (118,116,112,255), (144,142,138,255)])
            rect(img, max(0,x), y, min(G-1, x+w), min(G-1, y+row_h-1), tone)
            # sombra inferior de cada bloco
            rect(img, max(0,x), min(G-1, y+row_h-2), min(G-1, x+w), min(G-1, y+row_h-1), (100,98,94,255))
            x += w + 1
        y += row_h
        r += 1
    return img

def tile_dungeon_floor():
    img = canvas()
    base = (64, 58, 70, 255)
    rect(img, 0, 0, G-1, G-1, base)
    rng = random.Random(7)
    # lajes retangulares com juntas escuras
    seg = 10
    for gy in range(0, G, seg):
        for gx in range(0, G, seg):
            crack = rng.random() < 0.3
            tone = rng.choice([(70,64,76,255),(58,52,64,255),(74,68,80,255)])
            rect(img, gx, gy, min(G-1,gx+seg-2), min(G-1,gy+seg-2), tone)
            if crack:
                cx, cy = gx+seg//2, gy+seg//2
                for i in range(3):
                    px(img, min(G-1,cx+i), min(G-1,cy+i//2), (46,40,52,255))
    return img

def tile_dungeon_wall():
    img = canvas()
    base = (30, 26, 36, 255)
    rect(img, 0, 0, G-1, G-1, base)
    rng = random.Random(8)
    for y in range(0, G, 7):
        rect(img, 0, y, G-1, y, (46, 40, 54, 255))
    for _ in range(8):
        x, y = rng.randrange(2, G-4), rng.randrange(2, G-4)
        px(img, x, y, (18, 60, 46, 180))  # umidade/musgo
        px(img, x+1, y+1, (18, 60, 46, 140))
    return img

def tile_sand():
    img = canvas()
    base = (224, 198, 142, 255)
    rect(img, 0, 0, G-1, G-1, base)
    rng = random.Random(9)
    for band in range(0, G, 4):
        wobble = int(2 * (1 if (band//4) % 2 else -1))
        for x in range(0, G, 8):
            rect(img, max(0,x+wobble), band, min(G-1, x+wobble+5), band, (204, 176, 118, 255))
    for _ in range(6):
        x, y = rng.randrange(1, G-1), rng.randrange(1, G-1)
        px(img, x, y, (170, 140, 92, 255))
    return img

def tile_tall_grass():
    img = canvas()
    rect(img, 0, 0, G-1, G-1, (44, 92, 42, 255))
    rng = random.Random(10)
    for x in range(0, G, 3):
        h = rng.randrange(5, 11)
        base_y = G - 1
        tone = rng.choice([(70,132,58,255), (58,116,48,255), (84,150,68,255)])
        for i in range(h):
            yy = base_y - i
            xx = x + (1 if i % 3 == 1 else 0)
            px(img, xx, yy, tone)
    return img

def tile_village_floor():
    img = canvas()
    plank = (176, 138, 92, 255)
    plank_d = (156, 118, 76, 255)
    rect(img, 0, 0, G-1, G-1, plank)
    rng = random.Random(11)
    # tábuas horizontais com veio de madeira
    for y in range(0, G, 5):
        tone = plank if (y // 5) % 2 == 0 else (168, 130, 86, 255)
        rect(img, 0, y, G-1, y+3, tone)
        rect(img, 0, y+4, G-1, y+4, plank_d)  # linha de junta
        for _ in range(3):
            x = rng.randrange(2, G-2)
            px(img, x, y+1, (146, 108, 68, 255))
            px(img, x, y+2, (146, 108, 68, 255))
    return img

def tile_bush():
    img = canvas()
    dark = (42, 92, 40, 255)
    mid = (58, 118, 50, 255)
    light = (76, 140, 62, 255)
    ImageDraw.Draw(img).ellipse([2, 10, 29, 30], fill=dark)
    ImageDraw.Draw(img).ellipse([5, 4, 24, 20], fill=mid)
    ImageDraw.Draw(img).ellipse([9, 8, 22, 18], fill=light)
    rng = random.Random(12)
    for _ in range(5):
        x, y = rng.randrange(6, 24), rng.randrange(8, 24)
        px(img, x, y, (196, 90, 90, 255))  # bagas
    return img

TILE_BUILDERS = {
    "grass": lambda: tile_grass(False),
    "grass_detail": lambda: tile_grass(True),
    "path": tile_path,
    "water": tile_water,
    "tree": tile_tree,
    "wall_stone": tile_wall_stone,
    "dungeon_floor": tile_dungeon_floor,
    "dungeon_wall": tile_dungeon_wall,
    "sand": tile_sand,
    "tall_grass": tile_tall_grass,
    "village_floor": tile_village_floor,
    "bush": tile_bush,
}

def build_tileset():
    tiles = [TILE_BUILDERS[name]() for name in TILE_NAMES]
    sheet = Image.new("RGBA", (G * len(tiles), G), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * G, 0))
    big = sheet.resize((G * len(tiles) * U, G * U), Image.NEAREST)
    big.save(os.path.join(TILES_DIR, "tileset.png"))
    print("tileset v2 ok:", TILE_NAMES, "-> tile size", OUT)

if __name__ == "__main__":
    build_tileset()
