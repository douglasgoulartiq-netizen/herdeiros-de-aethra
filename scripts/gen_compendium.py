#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera src/data/compendium.json — task #37 do backlog (Compêndio). Cada
entrada é lore de bestiário para um monstro de src/data/monsters.json:
um teaser (mostrado antes do primeiro abate, no CompendiumUI.js) e o lore
completo (revelado depois do primeiro abate). Não deriva progresso do
jogador — isso é responsabilidade de CompendiumSystem.js/personagem.compendio.
Idempotente: sobrescreve o arquivo inteiro com o mesmo conteúdo sempre.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "data", "monsters.json")
DST = os.path.join(ROOT, "src", "data", "compendium.json")

# teaser + lore por monstro, escrito à mão pra manter qualidade e coerência
# com o bioma/elemento/arquétipo já definidos em monsters.json.
LORE = {
    "slime": (
        "Uma massa gelatinosa se move devagar entre as árvores.",
        "Slimes nascem de resíduos mágicos deixados por feitiços mal descartados. Individualmente inofensivos, mas raramente andam sozinhos — onde há um, costuma haver uma ninhada inteira se alastrando pelo solo da floresta.",
    ),
    "morcego": (
        "Um bater de asas ecoa entre os galhos altos.",
        "Morcegos-sombra caçam por eco e pelo cheiro de medo. Vivem em bandos nos ocos de árvores antigas e evitam luz direta — por isso raramente são vistos durante o dia, apenas ouvidos.",
    ),
    "lobo": (
        "Olhos amarelos observam da escuridão da mata.",
        "Lobos da floresta caçam em pequenos grupos e coordenam ataques ao membro mais isolado da presa. Viajantes experientes sabem: se avistar um, provavelmente há outros dois por perto, fora de vista.",
    ),
    "goblin": (
        "Uma silhueta pequena e ágil espia por trás de uma moita.",
        "Goblins são oportunistas antes de tudo — preferem emboscar e fugir a lutar até o fim. Vivem em pequenos bandos organizados em torno de quem tem a arma mais afiada, não necessariamente o mais forte.",
    ),
    "bandido": (
        "Um vulto encapuzado bloqueia a passagem na estrada.",
        "Nem todo bandido nasceu criminoso — muitos são camponeses desesperados que a guerra ou a fome empurraram pra estrada. Isso não os torna menos perigosos: a desesperança costuma deixar as mãos mais rápidas no gatilho.",
    ),
    "esqueleto": (
        "Ossos se remexem sob os escombros de uma cripta esquecida.",
        "Restos mortais reanimados por magia sombria residual, presos a masmorras antigas onde morreram. Não sentem dor nem hesitação — só param quando destruídos ou quando a magia que os sustenta finalmente se esvai.",
    ),
    "aranha_gigante": (
        "Fios de teia grossos como cordas cobrem o teto da caverna.",
        "Aranhas gigantes tecem teias capazes de prender um humano adulto e injetam um veneno que paralisa lentamente. Preferem esperar a presa se debater até se cansar a atacar de frente.",
    ),
    "orc_selvagem": (
        "Um grunhido grave ressoa das profundezas da masmorra.",
        "Orcs selvagens vivem à margem dos clãs orcs organizados, expulsos ou fugidos, sobrevivendo sozinhos ou em pares. A solidão os tornou mais imprevisíveis e mais violentos que seus parentes de clã.",
    ),
    "dragao_jovem": (
        "O calor no ar aumenta muito antes de qualquer coisa aparecer.",
        "Ainda longe da maturidade, um Dragão Jovem já é capaz de incendiar uma vila inteira em minutos. Este exemplar fez uma masmorra abandonada de seu covil, e não tolera intrusos em seu território.",
    ),
    "javali": (
        "Um resfolegar pesado vem de trás da vegetação rasteira.",
        "Javalis selvagens são territoriais e atacam qualquer coisa que se aproxime demais de sua ninhada, sem aviso nem hesitação. Sua investida em linha reta é temida por quem já cruzou uma estrada com um por perto.",
    ),
    "lobo_sombrio": (
        "Uma sombra mais escura que a própria noite se move entre as árvores.",
        "Diz-se que Lobos Sombrios nascem quando um lobo comum morre em solo amaldiçoado e volta a andar movido por pura fome sombria. Caçam em silêncio absoluto — o primeiro sinal costuma ser tarde demais.",
    ),
    "sapo_venenoso": (
        "Um coaxar estranhamente alto ecoa perto da água parada.",
        "A pele deste sapo secreta uma toxina que causa náusea só de contato. Predadores locais aprenderam a evitá-lo há gerações — o mesmo conselho vale para viajantes desavisados.",
    ),
    "harpia": (
        "Um grito agudo corta o vento acima da estrada.",
        "Harpias fazem ninho em penhascos ao longo das estradas e mergulham sobre viajantes solitários, atacando de cima onde é mais difícil revidar. Costumam evitar grupos numerosos.",
    ),
    "touro_selvagem": (
        "O chão treme levemente sob passos pesados se aproximando.",
        "Touros selvagens que escaparam de criações abandonadas voltaram a viver soltos nas estradas, mais agressivos que o gado comum e sem medo algum de humanos armados.",
    ),
    "lodo_negro": (
        "Uma mancha viscosa e escura se arrasta lentamente pelo chão da floresta.",
        "Diferente do slime comum, o Lodo Negro é feito de matéria orgânica em decomposição impregnada de magia venenosa. Extremamente lento, mas seu toque corrói tecido e metal com a mesma facilidade.",
    ),
    "caranguejo_gigante": (
        "Algo grande se move logo abaixo da superfície da água.",
        "Caranguejos gigantes das águas costeiras têm uma casca capaz de deter uma lâmina comum. Preferem esperar submersos e emergir só quando a presa já está ao alcance das garras.",
    ),
    "urso_ancestral": (
        "Um rugido profundo faz os pássaros da floresta alçarem voo em pânico.",
        "Ursos ancestrais guardam segredos da floresta antiga que nenhum druida documentou por completo. Vivem por décadas em um mesmo território e reconhecem cada trilha, cada intruso, cada mudança.",
    ),
    "pirata_naufrago": (
        "Restos de um naufrágio recente boiam perto da costa.",
        "Sobreviventes de naufrágios que se recusaram a voltar pra terra firme, agora vivendo de saque em saque ao longo do litoral. Rápidos com a lâmina e mais rápidos ainda pra fugir com o que roubaram.",
    ),
    "druida_corrompido": (
        "Plantas ao redor parecem murchar e reviver ao mesmo tempo, de forma antinatural.",
        "Um druida que se aprofundou demais em magia proibida, perdendo o equilíbrio que a Ordem prega. Ainda cura e protege a natureza ao seu redor — mas agora por meios que a Ordem chamaria de heresia.",
    ),
    "escorpiao_gigante": (
        "Um rastro largo demais pra ser de um escorpião comum corta a areia.",
        "Nas dunas mais profundas do deserto, escorpiões crescem além do natural, alimentados por décadas de calor extremo e escassez. Seu ferrão carrega veneno o bastante pra imobilizar uma presa muito maior que eles.",
    ),
    "grifo_jovem": (
        "Uma sombra enorme cruza a estrada por um instante e desaparece.",
        "Metade águia, metade leão, o Grifo Jovem ainda está aprendendo a caçar sozinho — o que o torna imprevisível: ora ataca sem hesitar, ora foge ao menor sinal de resistência séria.",
    ),
    "necromante_errante": (
        "Um cheiro de terra revirada precede uma figura encapuzada.",
        "Expulso de toda cidade que já tentou viver, o Necromante Errante viaja reanimando o que encontra pelo caminho pra se proteger — um exército pequeno e descartável, sempre pronto pra ser reposto.",
    ),
    "serpente_marinha": (
        "A água se agita em um padrão longo demais pra ser onda natural.",
        "Serpentes marinhas raramente se aventuram perto da costa, mas quando o fazem é porque a caça em alto mar ficou escassa — e uma serpente faminta não hesita diante de embarcações pequenas.",
    ),
    "troll_das_cavernas": (
        "Um cheiro de mofo e carne velha enche o corredor da masmorra.",
        "Trolls das cavernas regeneram ferimentos com uma velocidade que aterroriza aventureiros de primeira viagem. A lenda diz que só fogo ou um golpe verdadeiramente decisivo impede a regeneração.",
    ),
    "golem_de_pedra": (
        "Rachaduras luminosas piscam ao longo de uma estátua que não deveria se mover.",
        "Construídos por magos antigos como guardiões eternos, Golens de Pedra continuam cumprindo ordens que seus criadores morreram há séculos sem revogar. Lentos, mas praticamente impossíveis de deter na força bruta.",
    ),
    "gargula": (
        "Uma estátua no teto da masmorra pisca — e não devia ser capaz disso.",
        "Gárgulas ficam imóveis por décadas, indistinguíveis de decoração de pedra comum, até que algo desperta seu instinto de guardiã. Combinam magia élfica esquecida com um corpo praticamente indestrutível em repouso.",
    ),
    "wyvern": (
        "Um grito estridente anuncia algo grande se aproximando pelo ar.",
        "Parentes menores dos dragões, Wyverns não cospem fogo, mas compensam com velocidade e um ferrão na cauda carregado de veneno paralisante. Caçam em território aberto, onde podem usar o vento a seu favor.",
    ),
    "senhor_da_cinza": (
        "O ar fica seco e quente muito antes de qualquer coisa se revelar.",
        "Um comandante que sobreviveu ao colapso de sua própria legião, carregando as cinzas de seus soldados caídos como lembrete e como arma. Comanda o que resta com uma disciplina fria, quase ritual.",
    ),
    "arauto_das_cinzas": (
        "Cinzas quentes caem do teto da masmorra como uma chuva impossível.",
        "O que resta de uma antiga ordem de guerreiros consumida por seu próprio fogo ritual, o Arauto das Cinzas não lidera exércitos — ele É o que sobrou de um. Encontrá-lo é encontrar o fim de uma história muito mais antiga que esta masmorra.",
    ),
    "rato_gigante": (
        "Algo pequeno e rápido demais corre por entre as raízes.",
        "Ratos gigantes vivem em ninhadas enormes sob as raízes da floresta e raramente representam perigo sozinhos — o problema é que raramente estão sozinhos.",
    ),
    "abelha_titan": (
        "Um zumbido grave demais pra ser de inseto comum vibra no ar.",
        "Abelhas titã defendem colmeias do tamanho de uma casa, e seu ferrão injeta veneno o bastante pra derrubar um javali adulto. Quem mexe numa, mexe com a colmeia inteira.",
    ),
    "corvo_ceifador": (
        "Um bando de corvos anormalmente grandes observa da copa das árvores mortas.",
        "Diz-se que Corvos Ceifadores aparecem onde alguém está prestes a morrer na estrada — na prática, são apenas rápidos o bastante pra chegar primeiro que os outros necrófagos, e a lenda cuidou do resto.",
    ),
    "cristal_ecoante": (
        "Um brilho fraco pulsa dentro da rocha, no ritmo de uma respiração que não deveria existir.",
        "Formações de cristal que absorveram magia residual das minas por séculos, até ganharem uma vontade rudimentar de proteger o veio mineral ao seu redor. Imóveis até serem provocados.",
    ),
    "wisp_radiante": (
        "Uma pequena luz flutua baixo sobre a trilha, quase gentil demais pra ser hostil.",
        "Wisps radiantes nascem nos pontos onde a luz do sol nunca deixou de tocar o solo das Colinas Douradas. Preferem curar o que consideram seu antes de qualquer coisa — inclusive outros monstros da região.",
    ),
    "sentinela_dourada": (
        "Uma armadura vazia, banhada de luz, se ergue sozinha no topo da colina.",
        "Erguidas por um culto solar esquecido para guardar as Colinas Douradas, as Sentinelas Douradas continuam de posto muito depois de seus criadores terem virado pó, imunes a fadiga e a dúvida.",
    ),
    "gralha_tempestuosa": (
        "Um bando denso de aves negras corta o vento em formação perfeita demais.",
        "Gralhas tempestuosas viajam sempre à frente de frentes de vento forte na Planície Ventosa, e aprenderam a usar as próprias rajadas para atacar de ângulos que nenhuma presa consegue prever.",
    ),
    "verme_das_dunas": (
        "A areia se move em ondas, como se algo enorme nadasse logo abaixo da superfície.",
        "Vermes das dunas passam a vida inteira sob a areia de Karn, emergindo só para se alimentar. Sentem vibração de passos a dezenas de metros de distância — ficar parado não ajuda.",
    ),
    "arraia_relampago": (
        "A água ao redor chispa com pequenos clarões antes de qualquer coisa aparecer.",
        "Arraias relâmpago acumulam carga elétrica nadando contra as correntes do Recife das Tempestades, e a descarregam de uma vez em qualquer coisa que se aproxime demais de seus filhotes.",
    ),
    "enguia_eletrica": (
        "Um choque leve percorre a água antes que a enguia sequer seja vista.",
        "Enguias elétricas do recife aprenderam a usar descargas fracas pra atordoar e roubar o que reluz de náufragos e mergulhadores distraídos, fugindo antes de qualquer reação.",
    ),
    "sentinela_arcana": (
        "Símbolos élficos gravados no ar pulsam em um padrão que não deveria se sustentar sozinho.",
        "Restos de um sistema de defesa arcano das Ruínas de Aethra Antiga, ainda conjurando feitiços de proteção para uma cidade que não existe mais há séculos.",
    ),
    "espectro_arcano": (
        "Uma silhueta translúcida se dobra de um jeito que nenhum corpo vivo conseguiria.",
        "O que sobra de um mago élfico que morreu tentando salvar Aethra Antiga, o Espectro Arcano ainda tenta reunir aliados ao seu redor — ecos de si mesmo, tão vazios quanto ele.",
    ),
    "lobo_gelido": (
        "Uma nuvem de vapor gelado sai da bruma antes da própria criatura.",
        "Lobos gélidos se adaptaram ao frio perpétuo do Pântano da Bruma há gerações, com presas capazes de congelar um ferimento no instante da mordida.",
    ),
    "bruxa_da_bruma": (
        "Uma figura encurvada tece formas de gelo no ar com as próprias mãos.",
        "Exilada por praticar magia gélida proibida, a Bruxa da Bruma vive isolada no pântano há tanto tempo que já não distingue mais aliado de intruso — e convoca espíritos gélidos para garantir que ninguém chegue perto o bastante pra descobrir.",
    ),
    "construto_arcano": (
        "Um gigante de pedra e runas se ergue devagar, como se estivesse acordando de um sono de séculos.",
        "O guardião mais avançado que os magos de Aethra Antiga conseguiram construir antes da queda da cidade, posicionado nos Confins do reino como última linha de defesa que ninguém mais lembra ter erguido.",
    ),
    "carrasco_de_cinzas": (
        "O calor se torna insuportável segundos antes de qualquer coisa se revelar na escuridão.",
        "Último executor de uma ordem militar extinta que se autoimolou em um ritual de poder, o Carrasco de Cinzas continua cumprindo sentenças de uma corte que não julga nada há gerações.",
    ),
}


def _lore_dos_chefes_de_zona():
    """Reaproveita o teaser/lore já escrito em gen_zone_bosses.py (task #45)
    pra cada um dos 21 chefes de zona, em vez de duplicar o texto aqui —
    fonte única de verdade pra personalidade/lore de cada chefe."""
    try:
        import gen_zone_bosses
    except ImportError:
        return {}
    return {b["id"]: (b["teaser"], b["lore"]) for b in gen_zone_bosses.BOSSES}


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        monstros = json.load(f)

    lore_completo = {**LORE, **_lore_dos_chefes_de_zona()}

    compendio = []
    for m in monstros:
        teaser, lore = lore_completo.get(m["id"], (
            f"Algo se move nas sombras de {m.get('bioma', ['?'])[0] if m.get('bioma') else '?'}.",
            f"Pouco se sabe sobre {m['nome']} além do que se observa em combate.",
        ))
        compendio.append({
            "id": m["id"],
            "nome": m["nome"],
            "chefe": bool(m.get("chefe", False)),
            "teaser": teaser,
            "lore": lore,
        })

    with open(DST, "w", encoding="utf-8") as f:
        json.dump(compendio, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"compendium.json gerado com {len(compendio)} entradas de bestiário.")


if __name__ == "__main__":
    main()
