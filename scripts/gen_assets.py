#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador procedural de assets em pixel art para o RPG.
Desenha em uma grade pequena (estilo retro) e faz upscale com NEAREST
para manter o visual "pixelado" nítido.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_DIR = os.path.join(ROOT, "assets", "tiles")
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")
ICONS_DIR = os.path.join(ROOT, "assets", "icons")
for d in (TILES_DIR, SPRITES_DIR, ICONS_DIR):
    os.makedirs(d, exist_ok=True)

GRID = 16          # resolução base do desenho
UPSCALE = 4         # fator de ampliação
OUT = GRID * UPSCALE

OUTLINE = (26, 22, 20, 255)

def canvas():
    return Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))

def px(img, x, y, color):
    if 0 <= x < GRID and 0 <= y < GRID:
        img.putpixel((x, y), color)

def rect(img, x0, y0, x1, y1, color):
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x1, y1], fill=color)

def save(img, path):
    big = img.resize((OUT, OUT), Image.NEAREST)
    big.save(path)

def outline_shape(img, color=OUTLINE):
    """Adiciona contorno escuro ao redor de pixels opacos."""
    w, h = img.size
    src = img.copy()
    for y in range(h):
        for x in range(w):
            if src.getpixel((x, y))[3] == 0:
                neigh = False
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] != 0:
                        neigh = True
                        break
                if neigh:
                    img.putpixel((x, y), color)

# ---------------------------------------------------------------------------
# TILESET (mundo aberto + masmorra)
# ---------------------------------------------------------------------------
TILE_NAMES = [
    "grass", "grass_detail", "path", "water", "tree", "wall_stone",
    "dungeon_floor", "dungeon_wall", "sand", "tall_grass", "village_floor", "bush",
]

def tile_grass(variant=False):
    img = canvas()
    rect(img, 0, 0, 15, 15, (86, 156, 74, 255))
    for (x, y) in [(2,2),(9,4),(5,9),(12,11),(3,13),(13,2)]:
        px(img, x, y, (70, 138, 60, 255))
    if variant:
        for (x, y) in [(6,6),(7,6),(6,7)]:
            px(img, x, y, (222, 128, 150, 255))
        px(img, 6, 5, (120, 200, 90, 255))
    return img

def tile_path():
    img = canvas()
    rect(img, 0, 0, 15, 15, (196, 164, 116, 255))
    for (x, y) in [(2,3),(10,2),(6,7),(13,9),(3,12),(9,13)]:
        px(img, x, y, (170, 138, 92, 255))
    return img

def tile_water():
    img = canvas()
    rect(img, 0, 0, 15, 15, (63, 121, 191, 255))
    for y in range(0, 16, 4):
        for x in range(16):
            if (x + y) % 8 < 3:
                px(img, x, y, (99, 160, 224, 255))
    return img

def tile_tree():
    img = canvas()
    rect(img, 6, 10, 9, 15, (92, 61, 39, 255))
    rect(img, 1, 1, 14, 11, (46, 105, 51, 255))
    rect(img, 3, 0, 12, 2, (56, 122, 60, 255))
    for (x, y) in [(4,4),(11,6),(6,9),(9,3)]:
        px(img, x, y, (36, 88, 42, 255))
    return img

def tile_wall_stone():
    img = canvas()
    rect(img, 0, 0, 15, 15, (120, 118, 116, 255))
    for y in range(0, 16, 4):
        for x in range(0, 16, 8):
            ox = 4 if (y // 4) % 2 else 0
            rect(img, (x+ox) % 16, y, min((x+ox) % 16 + 6, 15), y+3, (100, 98, 96, 255))
    outline_shape(img, (70, 68, 66, 255))
    return img

def tile_dungeon_floor():
    img = canvas()
    rect(img, 0, 0, 15, 15, (58, 52, 62, 255))
    for (x, y) in [(3,3),(11,4),(6,9),(12,12),(2,12)]:
        px(img, x, y, (48, 43, 52, 255))
    return img

def tile_dungeon_wall():
    img = canvas()
    rect(img, 0, 0, 15, 15, (34, 30, 38, 255))
    for y in range(0, 16, 4):
        rect(img, 0, y, 15, y, (50, 44, 56, 255))
    return img

def tile_sand():
    img = canvas()
    rect(img, 0, 0, 15, 15, (222, 197, 140, 255))
    for (x, y) in [(2,2),(9,4),(5,9),(12,11)]:
        px(img, x, y, (204, 176, 116, 255))
    return img

def tile_tall_grass():
    img = canvas()
    rect(img, 0, 0, 15, 15, (49, 99, 45, 255))
    for x in range(0, 16, 2):
        for y in range(0, 16, 3):
            px(img, x, y, (75, 138, 60, 255))
            px(img, x, y+1, (40, 84, 38, 255))
    return img

def tile_village_floor():
    img = canvas()
    rect(img, 0, 0, 15, 15, (176, 168, 156, 255))
    for y in range(0, 16, 4):
        for x in range(0, 16, 4):
            rect(img, x, y, x+3, y+3, (162, 154, 142, 255))
    outline_shape(img, (140, 132, 120, 255))
    return img

def tile_bush():
    img = canvas()
    rect(img, 2, 6, 13, 14, (52, 110, 48, 255))
    rect(img, 4, 3, 11, 8, (64, 128, 56, 255))
    for (x, y) in [(5,5),(9,6),(7,10)]:
        px(img, x, y, (40, 90, 40, 255))
    outline_shape(img)
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
    sheet = Image.new("RGBA", (GRID * len(tiles), GRID), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * GRID, 0))
    big = sheet.resize((GRID * len(tiles) * UPSCALE, GRID * UPSCALE), Image.NEAREST)
    big.save(os.path.join(TILES_DIR, "tileset.png"))
    print("tileset ok:", TILE_NAMES)

# ---------------------------------------------------------------------------
# PERSONAGENS (humanoide paramétrico: raça define pele/cabelo, classe define
# roupas/arma). Gera spritesheet com 4 frames: parado, andar1, andar2, ataque.
# ---------------------------------------------------------------------------
RACE_PALETTES = {
    "humano":    {"skin": (222, 176, 140, 255), "hair": (90, 60, 40, 255)},
    "elfo":      {"skin": (232, 205, 170, 255), "hair": (230, 220, 120, 255)},
    "anao":      {"skin": (206, 150, 110, 255), "hair": (150, 90, 50, 255)},
    "orc":       {"skin": (120, 158, 90, 255),  "hair": (40, 40, 40, 255)},
    "halfling":  {"skin": (224, 180, 140, 255), "hair": (120, 80, 40, 255)},
    "draconato": {"skin": (150, 90, 200, 255),  "hair": (60, 30, 80, 255)},
}

CLASS_STYLE = {
    "guerreiro":  {"armor": (150, 40, 40, 255),  "armor2": (110, 26, 26, 255), "accent": (190, 190, 195, 255), "weapon": "sword"},
    "mago":       {"armor": (60, 70, 160, 255),  "armor2": (40, 48, 120, 255), "accent": (210, 190, 255, 255), "weapon": "staff"},
    "ladino":     {"armor": (46, 90, 60, 255),   "armor2": (30, 64, 42, 255),  "accent": (20, 20, 24, 255),    "weapon": "dagger"},
    "clerigo":    {"armor": (222, 210, 180, 255),"armor2": (188, 172, 130, 255), "accent": (212, 176, 60, 255),"weapon": "mace"},
    "barbaro":    {"armor": (150, 96, 50, 255),  "armor2": (110, 68, 34, 255), "accent": (90, 60, 30, 255),    "weapon": "axe"},
    "patrulheiro":{"armor": (60, 110, 70, 255),  "armor2": (40, 82, 50, 255),  "accent": (90, 60, 30, 255),    "weapon": "bow"},
}

def draw_humanoid(skin, hair, armor, armor2, accent, pose="idle"):
    img = canvas()
    leg_off = 0
    arm_off = 0
    if pose == "walk1":
        leg_off = 1
    elif pose == "walk2":
        leg_off = -1
    elif pose == "attack":
        arm_off = -2

    # pernas / botas
    rect(img, 5, 12, 6, 14 + (1 if leg_off > 0 else 0), armor2)
    rect(img, 9, 12, 10, 14 - (1 if leg_off > 0 else 0), armor2)
    rect(img, 5, 14, 6, 15, (40, 32, 28, 255))
    rect(img, 9, 13 - (1 if leg_off > 0 else 0), 10, 14 - (1 if leg_off > 0 else 0), (40, 32, 28, 255))

    # tronco
    rect(img, 4, 7, 11, 12, armor)
    rect(img, 4, 10, 11, 11, armor2)
    rect(img, 7, 8, 8, 10, accent)

    # bracos
    rect(img, 2, 7 + max(arm_off,0), 3, 10 + max(arm_off,0), skin)
    rect(img, 12, 7 - max(arm_off,0), 13, 10 - max(arm_off,0), skin)

    # cabeca
    rect(img, 5, 2, 10, 7, skin)
    rect(img, 5, 1, 10, 2, hair)
    rect(img, 5, 2, 5, 4, hair)
    rect(img, 10, 2, 10, 4, hair)
    # olhos
    px(img, 6, 4, (30, 24, 22, 255))
    px(img, 9, 4, (30, 24, 22, 255))

    outline_shape(img)
    return img

def draw_weapon_overlay(kind, accent):
    img = canvas()
    metal = (198, 198, 205, 255)
    wood = (110, 74, 40, 255)
    if kind == "sword":
        rect(img, 13, 3, 13, 9, metal)
        rect(img, 12, 9, 14, 10, (90, 60, 30, 255))
    elif kind == "staff":
        rect(img, 13, 1, 13, 12, wood)
        rect(img, 12, 0, 14, 1, accent)
    elif kind == "dagger":
        rect(img, 13, 6, 13, 10, metal)
        rect(img, 12, 10, 14, 10, (60, 40, 20, 255))
    elif kind == "mace":
        rect(img, 13, 4, 13, 10, wood)
        rect(img, 12, 2, 14, 4, accent)
    elif kind == "axe":
        rect(img, 13, 3, 13, 11, wood)
        rect(img, 11, 2, 14, 5, metal)
    elif kind == "bow":
        rect(img, 13, 2, 14, 2, wood)
        rect(img, 12, 3, 13, 3, wood)
        rect(img, 12, 4, 12, 8, wood)
        rect(img, 12, 9, 13, 9, wood)
        rect(img, 13, 10, 14, 10, wood)
    outline_shape(img)
    return img

def build_characters():
    for race, rp in RACE_PALETTES.items():
        for cls, cs in CLASS_STYLE.items():
            frames = []
            for pose in ("idle", "walk1", "idle", "walk2"):
                base = draw_humanoid(rp["skin"], rp["hair"], cs["armor"], cs["armor2"], cs["accent"], pose)
                weap = draw_weapon_overlay(cs["weapon"], cs["accent"])
                frame = Image.alpha_composite(base, weap)
                frames.append(frame)
            sheet = Image.new("RGBA", (GRID * 4, GRID), (0, 0, 0, 0))
            for i, f in enumerate(frames):
                sheet.paste(f, (i * GRID, 0))
            big = sheet.resize((GRID * 4 * UPSCALE, GRID * UPSCALE), Image.NEAREST)
            big.save(os.path.join(SPRITES_DIR, f"pc_{race}_{cls}.png"))
    print("personagens ok:", len(RACE_PALETTES) * len(CLASS_STYLE), "combinacoes")

# ---------------------------------------------------------------------------
# MONSTROS
# ---------------------------------------------------------------------------
def monster_lobo():
    img = canvas()
    rect(img, 2, 8, 13, 13, (90, 90, 96, 255))
    rect(img, 9, 4, 14, 9, (100, 100, 106, 255))
    rect(img, 12, 3, 13, 4, (100,100,106,255))
    rect(img, 14, 4, 15, 5, (100,100,106,255))
    px(img, 13, 6, (220, 40, 40, 255))
    rect(img, 2, 13, 4, 15, (70,70,76,255))
    rect(img, 10, 13, 12, 15, (70,70,76,255))
    outline_shape(img)
    return img

def monster_goblin():
    img = canvas()
    rect(img, 4, 7, 11, 13, (86, 140, 70, 255))
    rect(img, 5, 3, 10, 8, (108, 168, 88, 255))
    rect(img, 3, 3, 5, 5, (108,168,88,255))
    rect(img, 10, 3, 12, 5, (108,168,88,255))
    px(img, 6, 6, (200,40,40,255))
    px(img, 9, 6, (200,40,40,255))
    rect(img, 5, 13, 6, 15, (60,50,30,255))
    rect(img, 9, 13, 10, 15, (60,50,30,255))
    rect(img, 12, 5, 13, 11, (150,150,155,255))
    outline_shape(img)
    return img

def monster_esqueleto():
    img = canvas()
    rect(img, 5, 2, 10, 6, (230, 228, 218, 255))
    px(img, 6, 4, (20,20,20,255))
    px(img, 9, 4, (20,20,20,255))
    rect(img, 5, 7, 10, 11, (222, 220, 210, 255))
    for x in range(5, 11):
        px(img, x, 8, (150,148,140,255))
    rect(img, 5, 12, 6, 15, (222,220,210,255))
    rect(img, 9, 12, 10, 15, (222,220,210,255))
    rect(img, 11, 4, 12, 12, (170,170,175,255))
    outline_shape(img)
    return img

def monster_aranha():
    img = canvas()
    rect(img, 5, 6, 10, 11, (40, 30, 50, 255))
    rect(img, 6, 5, 9, 7, (60,45,75,255))
    for i, dx in enumerate([-4,-3,3,4]):
        px(img, 7+dx, 7, (30,22,40,255))
        px(img, 7+dx, 9, (30,22,40,255))
    rect(img, 2, 6, 3, 6, (30,22,40,255))
    rect(img, 12, 6, 13, 6, (30,22,40,255))
    rect(img, 1, 9, 2, 9, (30,22,40,255))
    rect(img, 13, 9, 14, 9, (30,22,40,255))
    px(img, 6, 7, (210, 40, 40, 255))
    px(img, 9, 7, (210, 40, 40, 255))
    outline_shape(img)
    return img

def monster_slime():
    img = canvas()
    rect(img, 3, 8, 12, 14, (80, 190, 150, 255))
    rect(img, 4, 6, 11, 9, (100, 210, 170, 255))
    px(img, 6, 10, (20,20,20,255))
    px(img, 9, 10, (20,20,20,255))
    rect(img, 4, 13, 11, 14, (60, 160, 128, 255))
    outline_shape(img)
    return img

def monster_orc():
    img = canvas()
    rect(img, 4, 6, 11, 13, (90, 130, 70, 255))
    rect(img, 4, 3, 11, 7, (110, 150, 88, 255))
    rect(img, 5, 6, 6, 7, (230,230,225,255))
    rect(img, 9, 6, 10, 7, (230,230,225,255))
    px(img, 6, 4, (200,30,30,255))
    px(img, 9, 4, (200,30,30,255))
    rect(img, 4, 13, 6, 15, (50,40,20,255))
    rect(img, 9, 13, 11, 15, (50,40,20,255))
    rect(img, 12, 2, 13, 11, (150,150,155,255))
    rect(img, 10, 1, 15, 3, (150,150,155,255))
    outline_shape(img)
    return img

def monster_morcego():
    img = canvas()
    rect(img, 6, 6, 9, 10, (60, 40, 70, 255))
    rect(img, 0, 4, 6, 9, (80, 55, 92, 255))
    rect(img, 9, 4, 15, 9, (80, 55, 92, 255))
    px(img, 7, 8, (210,40,40,255))
    px(img, 8, 8, (210,40,40,255))
    outline_shape(img)
    return img

def monster_bandido():
    img = canvas()
    rect(img, 4, 7, 11, 13, (60, 60, 68, 255))
    rect(img, 5, 3, 10, 8, (200, 178, 150, 255))
    rect(img, 4, 3, 11, 5, (40,40,44,255))
    px(img, 6, 6, (20,20,20,255))
    px(img, 9, 6, (20,20,20,255))
    rect(img, 5, 13, 6, 15, (40,40,44,255))
    rect(img, 9, 13, 10, 15, (40,40,44,255))
    rect(img, 12, 6, 13, 11, (180,180,185,255))
    outline_shape(img)
    return img

def monster_dragao():
    img = canvas()
    rect(img, 3, 7, 12, 14, (170, 40, 50, 255))
    rect(img, 9, 3, 14, 8, (190, 55, 65, 255))
    rect(img, 13, 4, 15, 5, (190,55,65,255))
    px(img, 12, 5, (250, 220, 40, 255))
    rect(img, 2, 9, 4, 12, (140, 30, 40, 255))
    rect(img, 11, 9, 13, 12, (140, 30, 40, 255))
    rect(img, 8, 1, 10, 3, (140,30,40,255))
    for x in range(3, 12, 2):
        px(img, x, 7, (140,30,40,255))
    outline_shape(img)
    return img

MONSTER_BUILDERS = {
    "lobo": monster_lobo,
    "goblin": monster_goblin,
    "esqueleto": monster_esqueleto,
    "aranha_gigante": monster_aranha,
    "slime": monster_slime,
    "orc_selvagem": monster_orc,
    "morcego": monster_morcego,
    "bandido": monster_bandido,
    "dragao_jovem": monster_dragao,
}

def build_monsters():
    for name, fn in MONSTER_BUILDERS.items():
        frame1 = fn()
        frame2 = frame1.copy()
        # leve "respiração": desloca 1px verticalmente uma faixa central
        frame2 = frame2.transform((GRID, GRID), Image.AFFINE, (1, 0, 0, 0, 1, -1), resample=Image.NEAREST)
        sheet = Image.new("RGBA", (GRID * 2, GRID), (0, 0, 0, 0))
        sheet.paste(frame1, (0, 0))
        sheet.paste(frame2, (GRID, 0))
        big = sheet.resize((GRID * 2 * UPSCALE, GRID * UPSCALE), Image.NEAREST)
        big.save(os.path.join(SPRITES_DIR, f"mob_{name}.png"))
    print("monstros ok:", list(MONSTER_BUILDERS.keys()))

# ---------------------------------------------------------------------------
# ICONES DE ITENS (16x16 -> upscale). Sem borda de raridade (aplicada na UI).
# ---------------------------------------------------------------------------
def icon_base(color_fn):
    img = canvas()
    color_fn(img)
    outline_shape(img)
    return img

def icon_espada(img):
    rect(img, 7, 1, 8, 9, (200, 200, 208, 255))
    rect(img, 5, 9, 10, 10, (120, 80, 40, 255))
    rect(img, 6, 10, 9, 13, (90, 60, 30, 255))
    px(img, 7, 3, (230,230,238,255)); px(img, 8, 5, (230,230,238,255))

def icon_machado(img):
    rect(img, 7, 4, 8, 14, (110, 74, 40, 255))
    rect(img, 3, 1, 9, 6, (190, 190, 198, 255))
    rect(img, 3, 1, 4, 2, (230,230,238,255))

def icon_adaga(img):
    rect(img, 7, 3, 8, 8, (200, 200, 208, 255))
    rect(img, 6, 8, 9, 9, (90, 60, 30, 255))
    rect(img, 6, 9, 9, 12, (70, 46, 24, 255))

def icon_cajado(img):
    rect(img, 7, 3, 8, 14, (120, 82, 46, 255))
    rect(img, 5, 0, 10, 4, (150, 110, 230, 255))
    px(img, 7, 1, (210,190,255,255))

def icon_arco(img):
    rect(img, 3, 2, 4, 4, (120,82,46,255)); rect(img, 2, 4, 3, 6, (120,82,46,255))
    rect(img, 2, 6, 3, 9, (120,82,46,255)); rect(img, 2, 9, 3, 11, (120,82,46,255))
    rect(img, 3, 11, 4, 13, (120,82,46,255))
    rect(img, 4, 2, 12, 13, (0,0,0,0))
    for y in range(2, 14):
        px(img, 4 + abs(7-y), y, (210,190,150,255))

def icon_maca(img):
    rect(img, 7, 5, 8, 14, (120, 82, 46, 255))
    rect(img, 5, 1, 10, 6, (212, 176, 60, 255))
    px(img, 6, 2, (240,220,120,255))

def icon_escudo(img):
    rect(img, 3, 2, 12, 10, (150, 150, 158, 255))
    rect(img, 3, 10, 12, 12, (150,150,158,255))
    rect(img, 6, 12, 9, 13, (150,150,158,255))
    rect(img, 5, 4, 10, 9, (110, 40, 40, 255))

def icon_armadura(img):
    rect(img, 4, 3, 11, 12, (150, 150, 158, 255))
    rect(img, 4, 3, 6, 6, (120,120,128,255))
    rect(img, 9, 3, 11, 6, (120,120,128,255))
    rect(img, 6, 6, 9, 12, (110, 110, 118, 255))

def icon_elmo(img):
    rect(img, 4, 3, 11, 9, (150, 150, 158, 255))
    rect(img, 4, 9, 11, 11, (110,110,118,255))
    rect(img, 6, 6, 9, 8, (30, 28, 30, 255))

def icon_botas(img):
    rect(img, 3, 3, 6, 11, (110, 74, 40, 255))
    rect(img, 3, 11, 8, 13, (90, 60, 30, 255))
    rect(img, 9, 3, 12, 11, (110, 74, 40, 255))
    rect(img, 9, 11, 14, 13, (90, 60, 30, 255))

def icon_anel(img):
    for (x,y) in [(5,6),(6,5),(9,5),(10,6),(5,9),(6,10),(9,10),(10,9)]:
        px(img, x, y, (212, 176, 60, 255))
    px(img, 7, 4, (100, 200, 220, 255)); px(img, 8, 4, (100, 200, 220, 255))

def icon_amuleto(img):
    for x in range(5, 11):
        px(img, x, 2, (212,176,60,255))
    rect(img, 6, 5, 9, 11, (100, 200, 220, 255))
    rect(img, 7, 6, 8, 10, (150, 220, 235, 255))

def icon_pocao_vida(img):
    rect(img, 6, 2, 9, 4, (120,120,128,255))
    rect(img, 5, 4, 10, 13, (200, 220, 230, 180))
    rect(img, 5, 7, 10, 13, (210, 50, 60, 255))
    px(img, 6, 8, (240,120,120,255))

def icon_pocao_mana(img):
    rect(img, 6, 2, 9, 4, (120,120,128,255))
    rect(img, 5, 4, 10, 13, (200, 220, 230, 180))
    rect(img, 5, 7, 10, 13, (60, 90, 220, 255))
    px(img, 6, 8, (140,160,250,255))

def icon_erva(img):
    rect(img, 7, 6, 8, 13, (80, 130, 50, 255))
    rect(img, 4, 4, 7, 7, (90, 160, 60, 255))
    rect(img, 8, 3, 11, 6, (90, 160, 60, 255))
    rect(img, 5, 8, 7, 10, (90,160,60,255))

def icon_minerio(img):
    rect(img, 4, 5, 11, 12, (110, 108, 112, 255))
    px(img, 6, 7, (120, 200, 230, 255)); px(img, 8, 9, (120, 200, 230, 255))
    px(img, 9, 6, (120, 200, 230, 255))

def icon_madeira(img):
    rect(img, 3, 5, 12, 8, (140, 96, 54, 255))
    rect(img, 3, 9, 12, 12, (120, 80, 44, 255))
    for x in range(3, 12, 3):
        px(img, x, 6, (100,66,36,255))

def icon_gema(img):
    for y, (x0, x1) in [(3,(6,9)), (5,(4,11)), (8,(5,10)), (11,(6,9))]:
        rect(img, x0, y, x1, y, (60, 200, 190, 255))
    rect(img, 6, 4, 9, 10, (90, 230, 220, 255))

def icon_pergaminho(img):
    rect(img, 3, 4, 12, 11, (222, 205, 170, 255))
    rect(img, 3, 3, 12, 4, (200, 182, 145, 255))
    rect(img, 3, 11, 12, 12, (200, 182, 145, 255))
    for y in range(6, 10):
        rect(img, 5, y, 10, y, (150, 130, 95, 255))

ICON_BUILDERS = {
    "espada": icon_espada, "machado": icon_machado, "adaga": icon_adaga,
    "cajado": icon_cajado, "arco": icon_arco, "maca": icon_maca,
    "escudo": icon_escudo, "armadura": icon_armadura, "elmo": icon_elmo,
    "botas": icon_botas, "anel": icon_anel, "amuleto": icon_amuleto,
    "pocao_vida": icon_pocao_vida, "pocao_mana": icon_pocao_mana,
    "erva": icon_erva, "minerio": icon_minerio, "madeira": icon_madeira,
    "gema": icon_gema, "pergaminho": icon_pergaminho,
}

def build_icons():
    for name, fn in ICON_BUILDERS.items():
        img = icon_base(fn)
        save(img, os.path.join(ICONS_DIR, f"{name}.png"))
    # icone generico de bau e no de coleta tambem aqui
    print("icones ok:", list(ICON_BUILDERS.keys()))

# ---------------------------------------------------------------------------
# OBJETOS DE MUNDO: bau, no de coleta, npc marker, entrada de masmorra
# ---------------------------------------------------------------------------
def obj_bau(open_=False):
    img = canvas()
    rect(img, 2, 8, 13, 14, (110, 74, 40, 255))
    rect(img, 2, 8, 13, 9, (90, 58, 30, 255))
    if open_:
        rect(img, 2, 3, 13, 7, (140, 96, 54, 255))
        rect(img, 2, 3, 13, 4, (120, 80, 44, 255))
    else:
        rect(img, 2, 5, 13, 8, (140, 96, 54, 255))
    rect(img, 6, 8, 9, 10, (212, 176, 60, 255))
    outline_shape(img)
    return img

def obj_no_coleta(kind):
    img = canvas()
    if kind == "erva":
        rect(img, 6, 3, 9, 13, (70, 120, 45, 255))
        rect(img, 3, 6, 6, 9, (86, 150, 56, 255))
        rect(img, 9, 4, 12, 7, (86, 150, 56, 255))
        rect(img, 4, 9, 7, 12, (86, 150, 56, 255))
    elif kind == "minerio":
        rect(img, 2, 8, 13, 14, (100, 98, 96, 255))
        rect(img, 3, 4, 12, 9, (130, 128, 126, 255))
        px(img, 6, 6, (120, 200, 230, 255)); px(img, 9, 7, (120, 200, 230, 255))
    else:  # madeira (tronco)
        rect(img, 5, 2, 10, 14, (120, 82, 46, 255))
        for y in range(2, 15, 3):
            rect(img, 5, y, 10, y, (96, 64, 34, 255))
    outline_shape(img)
    return img

def obj_npc_marker():
    img = canvas()
    rect(img, 6, 1, 9, 9, (212, 176, 60, 255))
    rect(img, 7, 9, 8, 13, (212, 176, 60, 255))
    outline_shape(img)
    return img

def obj_entrada_masmorra():
    img = canvas()
    rect(img, 2, 2, 13, 14, (40, 36, 44, 255))
    rect(img, 4, 5, 11, 14, (12, 10, 14, 255))
    rect(img, 3, 1, 12, 2, (60, 54, 64, 255))
    outline_shape(img)
    return img

def build_world_objects():
    save(obj_bau(False), os.path.join(SPRITES_DIR, "bau_fechado.png"))
    save(obj_bau(True), os.path.join(SPRITES_DIR, "bau_aberto.png"))
    for kind in ("erva", "minerio", "madeira"):
        save(obj_no_coleta(kind), os.path.join(SPRITES_DIR, f"no_{kind}.png"))
    save(obj_npc_marker(), os.path.join(SPRITES_DIR, "npc_marker.png"))
    save(obj_entrada_masmorra(), os.path.join(SPRITES_DIR, "entrada_masmorra.png"))
    print("objetos de mundo ok")

if __name__ == "__main__":
    build_tileset()
    build_characters()
    build_monsters()
    build_icons()
    build_world_objects()
    print("TUDO PRONTO")
