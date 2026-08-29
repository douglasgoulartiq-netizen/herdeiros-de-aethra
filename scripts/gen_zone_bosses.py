#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera os 21 chefes obrigatórios do mundo aberto — task #45 do backlog: 1
chefe único por área do mundo aberto (as 21 ZONAS de src/data/worldMap.js,
excluindo a "vila", que é segura). Diferente dos chefes de masmorra
(dragao_jovem, arauto_das_cinzas), estes ficam parados num ponto fixo
dentro da própria zona do mundo aberto — o jogador anda até lá e interage,
igual a um baú ou nó de coleta.

Cada chefe tem: arquétipo de IA sorteado dentre os 12 existentes (variado
entre os 21, não repetindo padrão), uma fala de efeito (personalidade
própria, mostrada na tela de ameaça antes do combate) e um drop exclusivo
de arma/material/acessório/armadura que só ele derruba.

Idempotente: sobrescreve monsters.json/items.json/lootTables.json com o
mesmo conteúdo sempre (remove entradas antigas com os mesmos ids antes de
reinserir) e faz a inserção em worldMap.js via regex ancorada no bloco de
cada zona — segura pra rodar de novo, desde que os ids de zona não mudem.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MONSTERS_PATH = os.path.join(ROOT, "src", "data", "monsters.json")
ITEMS_PATH = os.path.join(ROOT, "src", "data", "items.json")
LOOT_PATH = os.path.join(ROOT, "src", "data", "lootTables.json")
WORLDMAP_PATH = os.path.join(ROOT, "src", "data", "worldMap.js")

# nivel, elemento e arquétipo escolhidos pra combinar com o elementoDominante
# e o nivelSugerido de cada zona (ver worldMap.js) — o próprio elemento do
# chefe é só sabor narrativo (o bônus/resistência de terreno da task #42 não
# depende do elemento do monstro, só do elemento do ataque vs. o terreno).
BOSSES = [
    dict(zona="floresta", id="guardiao_das_raizes", nome="Guardião das Raízes Antigas",
         nivel=5, elemento="natureza", arquetipo="defensor", vel=5, bioma="floresta",
         x=20, y=17,
         fala="\"Estas raízes bebem da mesma água que você. Vá em paz, ou vire adubo.\"",
         teaser="Uma silhueta coberta de musgo se ergue entre as árvores mais antigas da floresta, bloqueando a trilha.",
         lore="Nascido da própria floresta há mais tempo do que qualquer aldeão consegue lembrar, o Guardião das Raízes Antigas não ataca por maldade — apenas nunca perdoou quem já feriu suas árvores.",
         drop=dict(id="coracao_de_carvalho", nome="Coração de Carvalho Ancestral", tipo="material", subtipo="coleta",
                    icone="madeira", raridade="epico", valor=95,
                    descricao="Coração de Carvalho Ancestral, extraído só do Guardião das Raízes Antigas. Usado em receitas de forja raras.")),
    dict(zona="bosque_sombrio", id="devoradora_de_sombras", nome="Devoradora de Sombras",
         nivel=7, elemento="sombrio", arquetipo="cacador", vel=13, bioma="floresta",
         x=44, y=4,
         fala="\"Você não me viu chegar. Ninguém vê.\"",
         teaser="Um vulto mais rápido que qualquer sombra normal risca entre os troncos retorcidos do bosque.",
         lore="Ninguém sabe se a Devoradora de Sombras já foi humana. O que se sabe é que ela caça sozinha, em silêncio absoluto, e só é vista por quem já não tem tempo de fugir.",
         drop=dict(id="presas_da_devoradora", nome="Presas da Devoradora", tipo="arma", subtipo="adaga",
                    classeRecomendada="ladino", icone="adaga", raridade="epico", dano=24, atributo="DES", valor=190,
                    elemento="sombrio", descricao="Uma adaga da devoradora. Dano baseado em DES.")),
    dict(zona="colinas_douradas", id="paladino_do_sol_poente", nome="Paladino do Sol Poente",
         nivel=8, elemento="radiante", arquetipo="comandante", vel=7, bioma="estrada",
         x=65, y=3,
         fala="\"Ajoelhe-se diante da luz, ou seja purificado por ela.\"",
         teaser="Uma figura em armadura dourada observa o vale do alto da colina, brilhando mesmo sob nuvens.",
         lore="Último remanescente de um culto solar extinto, o Paladino do Sol Poente ainda acredita estar cumprindo uma cruzada sagrada — mesmo sem exército, sem templo e sem ninguém mais pra liderar.",
         drop=dict(id="martelo_do_sol_poente", nome="Martelo do Sol Poente", tipo="arma", subtipo="maca",
                    classeRecomendada="clerigo", icone="maca", raridade="epico", dano=23, atributo="CON", valor=190,
                    elemento="radiante", descricao="Uma maça do sol poente. Dano baseado em CON.")),
    dict(zona="pantano_negro", id="bruxa_do_lodo_eterno", nome="Bruxa do Lodo Eterno",
         nivel=9, elemento="veneno", arquetipo="conjurador", vel=6, bioma="floresta",
         x=78, y=4,
         fala="\"O pântano não perdoa. Eu só ajudo ele a lembrar disso.\"",
         teaser="A água parada borbulha sem vento, e um cheiro adocicado demais avisa que algo está observando.",
         lore="Exilada no pântano por praticar magia proibida, a Bruxa do Lodo Eterno moldou o próprio veneno da terra em feitiços que nenhum grimório documentou — e não pretende compartilhar a fórmula.",
         drop=dict(id="cajado_do_lodo_eterno", nome="Cajado do Lodo Eterno", tipo="arma", subtipo="cajado",
                    classeRecomendada="mago", icone="cajado", raridade="epico", dano=21, atributo="INT", valor=190,
                    elemento="veneno", descricao="Um cajado do lodo eterno. Dano baseado em INT.")),
    dict(zona="costa_aurora", id="capita_mare_negra", nome="Capitã Maré-Negra",
         nivel=10, elemento="agua", arquetipo="ladrao", vel=10, bioma="aguas",
         x=92, y=4,
         fala="\"Relaxa. Eu só quero o que reluz — e sua vida não reluz tanto assim.\"",
         teaser="Os destroços de um navio se remexem, e uma figura encapuzada emerge da espuma com uma lâmina na mão.",
         lore="Sobrevivente do pior naufrágio que a Costa da Aurora já viu, a Capitã Maré-Negra decidiu que, se o mar levou tudo dela, ela levaria tudo de quem passasse por ali.",
         drop=dict(id="adaga_da_mare_negra", nome="Adaga da Maré-Negra", tipo="arma", subtipo="adaga",
                    classeRecomendada="ladino", icone="adaga", raridade="epico", dano=25, atributo="DES", valor=205,
                    elemento="agua", descricao="Uma adaga da maré-negra. Dano baseado em DES.")),
    dict(zona="charco_fetido", id="tirano_do_charco", nome="Tirano do Charco",
         nivel=7, elemento="veneno", arquetipo="fanatico", vel=4, bioma="floresta",
         x=4, y=27,
         fala="\"Não corro. Nunca precisei.\"",
         teaser="Uma massa disforme e enorme se ergue lentamente da lama, pingando um líquido escuro.",
         lore="O Tirano do Charco cresceu absorvendo tudo que se afogou no brejo por gerações — animais, viajantes, até outros slimes menores. Não tem pressa, porque nunca precisou ter.",
         drop=dict(id="viscera_toxica", nome="Víscera Tóxica Cristalizada", tipo="material", subtipo="coleta",
                    icone="gema", raridade="epico", valor=95,
                    descricao="Víscera Tóxica Cristalizada, extraída só do Tirano do Charco. Usado em receitas de forja raras.")),
    dict(zona="vale_pedras", id="colosso_das_pedras_cinzentas", nome="Colosso das Pedras Cinzentas",
         nivel=8, elemento="terra", arquetipo="controlador", vel=4, bioma="estrada",
         x=30, y=35,
         fala="\"Vocês constroem em cima de mim há gerações. Chega.\"",
         teaser="Uma formação rochosa no meio do vale se move devagar, e pedras soltas rolam encosta abaixo sozinhas.",
         lore="O Colosso das Pedras Cinzentas dormiu tanto tempo sob o vale que comerciantes construíram estradas inteiras sobre suas costas sem perceber — até o dia em que ele decidiu se levantar.",
         drop=dict(id="nucleo_do_colosso", nome="Núcleo do Colosso", tipo="material", subtipo="coleta",
                    icone="minerio", raridade="epico", valor=95,
                    descricao="Núcleo do Colosso, extraído só do Colosso das Pedras Cinzentas. Usado em receitas de forja raras.")),
    dict(zona="floresta_ancestral", id="matriarca_ursina", nome="Matriarca Ursina",
         nivel=10, elemento="natureza", arquetipo="agressor", vel=8, bioma="floresta",
         x=44, y=37,
         fala="\"Chegou perto demais da minha ninhada. Isso não tem volta.\"",
         teaser="Um rugido profundo faz o chão vibrar antes de qualquer coisa aparecer entre as árvores milenares.",
         lore="Maior e mais velha que qualquer urso ancestral da região, a Matriarca Ursina protege gerações de filhotes na Floresta Ancestral com uma fúria que nenhum druida ousa testar duas vezes.",
         drop=dict(id="garras_da_matriarca", nome="Garras da Matriarca", tipo="arma", subtipo="machado",
                    classeRecomendada="barbaro", icone="machado", raridade="epico", dano=27, atributo="FOR", valor=210,
                    elemento="natureza", descricao="Um machado da matriarca. Dano baseado em FOR.")),
    dict(zona="planicie_ventosa", id="grifo_alfa_dos_ventos", nome="Grifo Alfa dos Ventos",
         nivel=11, elemento="vento", arquetipo="atirador", vel=14, bioma="estrada",
         x=56, y=30,
         fala="\"Lá embaixo vocês nem veem a tempestade chegar. Eu sou a tempestade.\"",
         teaser="Uma sombra enorme cruza a planície repetidas vezes, alto demais pra qualquer flecha alcançar.",
         lore="Líder do bando de grifos que domina os céus da Planície Ventosa, o Grifo Alfa nunca pousa perto de estranhos — prefere atacar em mergulhos que ninguém consegue prever a tempo.",
         drop=dict(id="arco_do_grifo_alfa", nome="Arco de Pena do Grifo Alfa", tipo="arma", subtipo="arco",
                    classeRecomendada="patrulheiro", icone="arco", raridade="epico", dano=26, atributo="DES", valor=210,
                    elemento="vento", descricao="Um arco do grifo alfa. Dano baseado em DES.")),
    dict(zona="deserto_karn", id="rainha_escorpiao_de_karn", nome="Rainha Escorpião de Karn",
         nivel=12, elemento="fogo", arquetipo="controlador", vel=7, bioma="deserto",
         x=74, y=28,
         fala="\"Minhas irmãs já provaram seu sangue. Agora é minha vez.\"",
         teaser="A areia ao redor treme em ondas coordenadas, como se dezenas de patas se movessem juntas logo abaixo.",
         lore="Nenhum escorpião gigante das dunas de Karn nasce sem antes prestar contas à Rainha — a maior, mais velha e mais paciente de todas, que comanda o enxame de baixo da areia escaldante.",
         drop=dict(id="ferrao_da_rainha_de_karn", nome="Ferrão da Rainha de Karn", tipo="arma", subtipo="adaga",
                    classeRecomendada="ladino", icone="adaga", raridade="epico", dano=29, atributo="DES", valor=225,
                    elemento="fogo", descricao="Uma adaga da rainha de karn. Dano baseado em DES.")),
    dict(zona="recife_tempestades", id="serpente_da_tempestade_eterna", nome="Serpente da Tempestade Eterna",
         nivel=13, elemento="raio", arquetipo="invocador", vel=9, bioma="aguas",
         x=101, y=30,
         fala="\"O céu já era meu antes de qualquer marinheiro desenhar um mapa.\"",
         teaser="Relâmpagos cortam o céu sem nuvem alguma acima do recife, num padrão longo demais pra ser natural.",
         lore="A Serpente da Tempestade Eterna vive há tanto tempo entre os relâmpagos do recife que já não distingue mais a própria fúria da tempestade que a alimenta — e convoca a tormenta pra lutar ao seu lado.",
         drop=dict(id="cajado_da_tempestade_eterna", nome="Cajado da Tempestade Eterna", tipo="arma", subtipo="cajado",
                    classeRecomendada="mago", icone="cajado", raridade="lendario", dano=30, atributo="INT", valor=310,
                    elemento="raio", descricao="Um cajado da tempestade eterna. Dano baseado em INT.")),
    dict(zona="terras_esquecidas", id="cavaleiro_caido_de_aethra", nome="Cavaleiro Caído de Aethra",
         nivel=10, elemento="sombrio", arquetipo="comandante", vel=6, bioma="estrada",
         x=4, y=48,
         fala="\"Jurei defender este reino até a morte. A morte só não foi o fim que eu esperava.\"",
         teaser="Uma armadura enferrujada se move sozinha entre as fundações caídas, como se ainda montasse guarda.",
         lore="Morto defendendo Aethra numa guerra que a história já esqueceu, o Cavaleiro Caído continua patrulhando terras que não existem mais, incapaz de aceitar que o reino que jurou proteger já não precisa dele.",
         drop=dict(id="lamina_do_cavaleiro_caido", nome="Lâmina do Cavaleiro Caído", tipo="arma", subtipo="espada",
                    classeRecomendada="guerreiro", icone="espada", raridade="epico", dano=28, atributo="FOR", valor=225,
                    elemento="sombrio", descricao="Uma espada do cavaleiro caído. Dano baseado em FOR.")),
    dict(zona="caverna_eco", id="troll_anciao_do_eco", nome="Troll Ancião do Eco",
         nivel=12, elemento="terra", arquetipo="fanatico", vel=5, bioma="masmorra",
         x=24, y=50,
         fala="\"Corte o quanto quiser. Eu tenho mais tempo que você.\"",
         teaser="Um gemido grave ecoa pela caverna, seguido de um cheiro de mofo antigo demais pra ser recente.",
         lore="Mais velho que qualquer troll das cavernas comuns, o Troll Ancião do Eco regenera ferimentos numa velocidade que desafia a lógica — décadas de batalhas o ensinaram que só é preciso sobreviver mais que o adversário.",
         drop=dict(id="pele_regenerativa", nome="Pele Regenerativa do Troll Ancião", tipo="material", subtipo="coleta",
                    icone="minerio", raridade="epico", valor=110,
                    descricao="Pele Regenerativa do Troll Ancião, extraída só dele. Usado em receitas de forja raras.")),
    dict(zona="ruinas_aethra", id="guardiao_arcano_das_ruinas", nome="Guardião Arcano das Ruínas",
         nivel=13, elemento="arcano", arquetipo="conjurador", vel=7, bioma="masmorra",
         x=41, y=49,
         fala="\"Aethra Antiga caiu. Minhas ordens, não.\"",
         teaser="Símbolos élficos gravados em colunas caídas voltam a brilhar, um por um, à medida que você se aproxima.",
         lore="Erguido para proteger o coração mágico de Aethra Antiga, o Guardião Arcano continua cumprindo a última ordem que recebeu séculos atrás — mesmo que a cidade que deveria proteger não seja mais que ruína.",
         drop=dict(id="amuleto_do_guardiao_arcano", nome="Amuleto do Guardião Arcano", tipo="acessorio", slot="amuleto",
                    icone="amuleto", raridade="lendario", bonusAtributo={"INT": 3}, valor=310,
                    descricao="+3 de Inteligência. Relíquia do Guardião Arcano das Ruínas de Aethra Antiga.")),
    dict(zona="bosque_petrificado", id="rei_petrificado", nome="Rei Petrificado",
         nivel=14, elemento="terra", arquetipo="defensor", vel=4, bioma="deserto",
         x=60, y=48,
         fala="\"Fui rei de carne. Agora sou rei de pedra. Nenhuma lâmina muda isso.\"",
         teaser="Uma estátua real, coroa e tudo, ocupa o centro do bosque petrificado — e a coroa acabou de se mexer.",
         lore="Amaldiçoado junto com toda sua corte por uma magia esquecida séculos atrás, o Rei Petrificado continua reinando sobre um bosque de árvores igualmente petrificadas, o único súdito que lhe resta.",
         drop=dict(id="couraca_do_rei_petrificado", nome="Couraça do Rei Petrificado", tipo="armadura", subtipo="armadura",
                    slot="peito", icone="armadura", raridade="epico", defesa=19, valor=225,
                    descricao="Couraça do Rei Petrificado, oferece 19 de defesa.")),
    dict(zona="deserto_ardente", id="senhor_das_chamas_errantes", nome="Senhor das Chamas Errantes",
         nivel=15, elemento="fogo", arquetipo="agressor", vel=9, bioma="deserto",
         x=78, y=48,
         fala="\"Fui general. Agora sou incêndio. Corre a mesma diferença.\"",
         teaser="O ar treme de calor muito antes de qualquer silhueta aparecer entre as dunas ardentes.",
         lore="Consumido pelo próprio fogo ritual junto com a legião que comandava, o Senhor das Chamas Errantes vaga pelo deserto ardente incapaz de se apagar, incendiando tudo que ainda confunde com inimigo.",
         drop=dict(id="machado_das_chamas_errantes", nome="Machado das Chamas Errantes", tipo="arma", subtipo="machado",
                    classeRecomendada="barbaro", icone="machado", raridade="lendario", dano=33, atributo="FOR", valor=320,
                    elemento="fogo", descricao="Um machado das chamas errantes. Dano baseado em FOR.")),
    dict(zona="falesias_fim", id="matriarca_wyvern_das_falesias", nome="Matriarca Wyvern das Falésias",
         nivel=16, elemento="vento", arquetipo="atirador", vel=13, bioma="estrada",
         x=97, y=48,
         fala="\"Cada ninho aqui é meu. Cada penhasco é meu. Você é só de passagem.\"",
         teaser="Um grito estridente ecoa pelos penhascos, seguido de uma sombra enorme cortando o vento.",
         lore="Mais velha e maior que qualquer wyvern comum, a Matriarca governa todos os ninhos das Falésias do Fim havia gerações — e nenhum invasor que chegou perto da prole voltou pra contar a história.",
         drop=dict(id="arco_da_matriarca_wyvern", nome="Arco da Matriarca Wyvern", tipo="arma", subtipo="arco",
                    classeRecomendada="patrulheiro", icone="arco", raridade="lendario", dano=32, atributo="DES", valor=320,
                    elemento="vento", descricao="Um arco da matriarca wyvern. Dano baseado em DES.")),
    dict(zona="pantano_bruma", id="matriarca_da_bruma_eterna", nome="Matriarca da Bruma Eterna",
         nivel=14, elemento="gelo", arquetipo="suporte", vel=6, bioma="floresta",
         x=12, y=68,
         fala="\"A névoa cuida de quem é meu. Você não é.\"",
         teaser="A névoa perpétua do pântano se adensa ao redor de uma figura imóvel, como se a obedecesse.",
         lore="A Matriarca da Bruma Eterna comanda cada troll e lodo do Pântano da Bruma como se fossem filhos — e não hesita em envolver a todos numa névoa gélida protetora quando um deles está em perigo.",
         drop=dict(id="anel_da_bruma_eterna", nome="Anel da Bruma Eterna", tipo="acessorio", slot="anel",
                    icone="anel", raridade="epico", bonusAtributo={"CON": 3}, valor=240,
                    descricao="+3 de Constituição. Relíquia da Matriarca da Bruma Eterna.")),
    dict(zona="montanha_sombria", id="senhor_sombrio_da_montanha", nome="Senhor Sombrio da Montanha",
         nivel=17, elemento="sombrio", arquetipo="comandante", vel=8, bioma="masmorra",
         x=22, y=65,
         fala="\"Todo golem e troll aqui responde a mim. Em breve, você também vai entender por quê.\"",
         teaser="A escuridão no topo da montanha parece mais densa que o resto da noite, e nada mais se move perto dela.",
         lore="Ninguém sabe se o Senhor Sombrio nasceu junto com a montanha ou se a conquistou séculos atrás — só que golens, trolls e gárgulas de toda a região respondem à sua vontade sem hesitar.",
         drop=dict(id="espada_do_senhor_sombrio", nome="Espada do Senhor Sombrio", tipo="arma", subtipo="espada",
                    classeRecomendada="guerreiro", icone="espada", raridade="lendario", dano=35, atributo="FOR", valor=340,
                    elemento="sombrio", descricao="Uma espada do senhor sombrio. Dano baseado em FOR.")),
    dict(zona="covil_do_dragao", id="dragao_anciao_das_cinzas", nome="Dragão Ancião das Cinzas",
         nivel=18, elemento="fogo", arquetipo="comandante", vel=8, bioma="masmorra",
         x=38, y=60,
         fala="\"O jovem que vive na masmorra abaixo é meu filhote. Você já devia estar com medo do suficiente.\"",
         teaser="O calor no covil aumenta a níveis insuportáveis muito antes de qualquer coisa se revelar.",
         lore="Mãe do Dragão Jovem que guarda a masmorra logo abaixo, o Dragão Ancião das Cinzas patrulha a terra arrasada ao redor do covil e não perdoa quem se aproxima demais da prole.",
         drop=dict(id="escama_do_dragao_anciao", nome="Escama do Dragão Ancião", tipo="material", subtipo="coleta",
                    icone="gema", raridade="lendario", valor=340,
                    descricao="Escama do Dragão Ancião das Cinzas, extraída só dele. Usado em receitas de forja lendárias.")),
    dict(zona="confins_aethra", id="imperador_arcano_dos_confins", nome="Imperador Arcano dos Confins",
         nivel=20, elemento="arcano", arquetipo="comandante", vel=10, bioma="masmorra",
         x=63, y=64,
         fala="\"Aethra caiu, se ergueu e caiu de novo, e eu vi tudo do meu trono de cinzas. Você é só mais um capítulo curto.\"",
         teaser="No topo do Trono de Cinzas, uma figura coroada de energia arcana observa sua chegada sem se mover.",
         lore="O que resta do último imperador de Aethra Antiga, transformado em algo mais que humano pela mesma magia que destruiu seu próprio reino. Governa os Confins como governou a cidade — sozinho, e para sempre.",
         drop=dict(id="cetro_do_imperador_arcano", nome="Cetro do Imperador Arcano", tipo="arma", subtipo="cajado",
                    classeRecomendada="mago", icone="cajado", raridade="lendario", dano=38, atributo="INT", valor=420,
                    elemento="arcano", descricao="Um cajado do imperador arcano. Dano baseado em INT.")),
]


def stats_por_nivel(nivel):
    """Curva de stats de chefe: mais forte que qualquer monstro comum do
    mesmo nível (ver monsters.json), mas ainda batível por um time de até
    4 personagens preparado — mesma filosofia dos chefes de masmorra
    (dragao_jovem nivel 6 ~120hp, arauto_das_cinzas nivel 16 ~260hp)."""
    hp = round((18 + 8.6 * nivel) * 1.55)
    atk = round((3.4 + 1.85 * nivel) * 1.3)
    defesa = round((1.2 + 1.05 * nivel) * 1.15)
    xp = round(6.2 * nivel * 2.15)
    ouro_min = round(2.6 * nivel * 2.0)
    ouro_max = round(4.4 * nivel * 2.0)
    return hp, atk, defesa, xp, ouro_min, ouro_max


def main():
    with open(MONSTERS_PATH, "r", encoding="utf-8") as f:
        monstros = json.load(f)
    with open(ITEMS_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)
    with open(LOOT_PATH, "r", encoding="utf-8") as f:
        loot = json.load(f)

    ids_novos = {b["id"] for b in BOSSES}
    drop_ids_novos = {b["drop"]["id"] for b in BOSSES}
    monstros = [m for m in monstros if m["id"] not in ids_novos]
    items["itens"] = [i for i in items["itens"] if i["id"] not in drop_ids_novos]

    for b in BOSSES:
        hp, atk, defesa, xp, ouro_min, ouro_max = stats_por_nivel(b["nivel"])
        monstros.append({
            "id": b["id"],
            "nome": b["nome"],
            "nivel": b["nivel"],
            "bioma": [b["bioma"]],
            "sprite": f"mob_{b['id']}",
            "hp": hp,
            "atk": atk,
            "defesa": defesa,
            "vel": b["vel"],
            "xp": xp,
            "ouroMin": ouro_min,
            "ouroMax": ouro_max,
            "chefe": True,
            "elemento": b["elemento"],
            "arquetipo": b["arquetipo"],
            "fala": b["fala"],
        })
        items["itens"].append(b["drop"])
        loot[b["id"]] = {
            "chanceDrop": 1.0,
            "pool": [
                {"itemId": b["drop"]["id"], "peso": 70},
                {"itemId": "gema_rara", "peso": 15},
                {"itemId": "pocao_vida_g", "peso": 15},
            ],
        }

    with open(MONSTERS_PATH, "w", encoding="utf-8") as f:
        json.dump(monstros, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(ITEMS_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(LOOT_PATH, "w", encoding="utf-8") as f:
        json.dump(loot, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # --- worldMap.js: injeta `chefe: {...}` no bloco de cada zona --------
    with open(WORLDMAP_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    for b in BOSSES:
        # Remove uma injeção anterior (reexecução idempotente).
        src = re.sub(
            r'\n\s*chefe: \{ x: \d+, y: \d+, monstroId: "' + re.escape(b["id"]) + r'" \}, // task #45.*',
            "", src,
        )
        marcador = f'id: "{b["zona"]}",'
        idx = src.index(marcador)
        # Insere logo após a linha "elementoDominante: ..." do bloco da zona.
        fim_elemento = src.index("\n", src.index("elementoDominante:", idx))
        linha = f'\n    chefe: {{ x: {b["x"]}, y: {b["y"]}, monstroId: "{b["id"]}" }}, // task #45: chefe obrigatório da zona'
        src = src[:fim_elemento] + linha + src[fim_elemento:]

    with open(WORLDMAP_PATH, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"{len(BOSSES)} chefes de zona gerados (monsters.json, items.json, lootTables.json, worldMap.js).")


if __name__ == "__main__":
    main()
