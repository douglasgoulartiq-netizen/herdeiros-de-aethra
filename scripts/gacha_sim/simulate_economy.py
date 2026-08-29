#!/usr/bin/env python3
"""
Simulador de economia do sistema de gacha "Fragmentos de Aethra"
(Herdeiros de Aethra).

Este script NAO altera nenhum arquivo do jogo. Ele apenas roda uma
simulacao de Monte Carlo (vetorizada com numpy) para validar as regras
de pity/garantias e as fontes de renda semanal de fragmentos propostas
para o sistema de invocacao (gacha).

Uso:
    python3 simulate_economy.py

Saida:
    - Imprime um resumo no stdout
    - Escreve resultados detalhados em JSON em results.json
    - (o relatorio_economia.md e escrito separadamente, ver README no topo
      deste diretorio / relatorio gerado por build_report.py)
"""

import json
import time
import numpy as np

# --------------------------------------------------------------------------
# 1. CONSTANTES DO SISTEMA DE GACHA (regras ja definidas, NAO mexer)
# --------------------------------------------------------------------------

# Codigos de raridade (ordem crescente de valor)
COMUM, INCOMUM, RARO, EPICO, LENDARIO = 0, 1, 2, 3, 4
RARITY_NAMES = {
    COMUM: "Comum",
    INCOMUM: "Incomum",
    RARO: "Raro",
    EPICO: "Epico",
    LENDARIO: "Lendario",
}

# Taxas base (somam 100%)
BASE_RATES = {
    LENDARIO: 0.007,
    EPICO: 0.06,
    RARO: 0.15,
    INCOMUM: 0.33,
    COMUM: 0.453,
}
assert abs(sum(BASE_RATES.values()) - 1.0) < 1e-9

# Proporcoes relativas fixas entre as 4 raridades NAO-lendarias.
# Como a probabilidade de lendario muda durante a pity suave, a probabilidade
# remanescente (1 - p_lendario) e redistribuida MANTENDO a proporcao relativa
# entre epico/raro/incomum/comum (que e uma simples renormalizacao linear).
NON_LEG_WEIGHTS = np.array([
    BASE_RATES[EPICO], BASE_RATES[RARO], BASE_RATES[INCOMUM], BASE_RATES[COMUM]
])
NON_LEG_CODES = np.array([EPICO, RARO, INCOMUM, COMUM])
NON_LEG_CUM = np.cumsum(NON_LEG_WEIGHTS / NON_LEG_WEIGHTS.sum())  # cumulativo em [0,1]

# Curva de pity suave (pity soft): pull 40..50 -> probabilidade de lendario
SOFT_PITY = {
    40: 0.08, 41: 0.14, 42: 0.20, 43: 0.27, 44: 0.35, 45: 0.45,
    46: 0.57, 47: 0.70, 48: 0.82, 49: 0.92, 50: 1.00,
}
# tabela de lookup por indice de "pulls desde o ultimo lendario" (1..50)
PITY_PROB_TABLE = np.full(51, BASE_RATES[LENDARIO])
PITY_PROB_TABLE[0] = BASE_RATES[LENDARIO]  # indice 0 nao usado (contamos a partir de 1)
for k, v in SOFT_PITY.items():
    PITY_PROB_TABLE[k] = v

PULL_COST = 100  # fragmentos por pull (fixo, igual para todos)
BUNDLE_10_COST = 1000  # 10 pulls = 1000 fragmentos (sem desconto)

# Tamanhos de roster assumidos por raridade (NAO temos roster real do jogo -
# assumimos valores plausiveis so para poder medir "duplicatas".
# ASSUNCAO EXPLICITA, documentada no relatorio.)
ROSTER_SIZES = {
    COMUM: 20,
    INCOMUM: 15,
    RARO: 10,
    EPICO: 6,
    LENDARIO: 4,
}


# --------------------------------------------------------------------------
# 2. MOTOR DE SIMULACAO (vetorizado)
# --------------------------------------------------------------------------

def simulate_banner(n_players, n_pulls, seed, event_banner=False, track_duplicates=False):
    """
    Simula n_players jogadores fazendo n_pulls pulls sequenciais em uma
    categoria de banner (permanente ou evento), aplicando:
      - taxa base de lendario 0.7%
      - pity suave (pulls 40-49) e pity duro (pull 50 = garantido)
      - garantia de Raro+ a cada 10 pulls (contador reseta ao disparar ou
        ao sair um lendario)
      - garantia de Epico+ a cada 25 pulls (idem, tambem reseta o contador
        de 10)
      - (se event_banner=True) mecanica de 50/50 + persistencia da garantia
        de personagem em destaque ("featured")
      - (opcional) contagem de personagens novos vs duplicados, assumindo
        um roster fixo por raridade (ver ROSTER_SIZES)

    Retorna um dicionario de arrays numpy com os resultados por jogador.
    """
    rng = np.random.default_rng(seed)

    pity_counter = np.zeros(n_players, dtype=np.int32)   # pulls desde ultimo lendario
    counter10 = np.zeros(n_players, dtype=np.int32)
    counter25 = np.zeros(n_players, dtype=np.int32)

    first_legendary_pull = np.full(n_players, -1, dtype=np.int32)
    hardpity_flags = np.zeros((n_players, n_pulls), dtype=bool)
    rarity_history = np.zeros((n_players, n_pulls), dtype=np.int8)

    if event_banner:
        pending_featured = np.zeros(n_players, dtype=bool)
        first_featured_pull = np.full(n_players, -1, dtype=np.int32)

    if track_duplicates:
        owned = {r: np.zeros((n_players, size), dtype=bool) for r, size in ROSTER_SIZES.items()}
        new_char_flag = np.zeros((n_players, n_pulls), dtype=bool)

    for i in range(n_pulls):
        pity_counter += 1
        counter10 += 1
        counter25 += 1

        # clip de seguranca (nao deveria passar de 50 pois reseta ao lendario)
        idx = np.clip(pity_counter, 0, 50)
        leg_prob = PITY_PROB_TABLE[idx]

        r1 = rng.random(n_players)
        is_legendary = r1 < leg_prob
        # pity duro: pull 50 sem lendario = garantido (leg_prob ja e 1.0 nesse caso)

        # raridade natural para quem NAO tirou lendario (proporcoes fixas)
        r2 = rng.random(n_players)
        nat_idx = np.searchsorted(NON_LEG_CUM, r2, side="right")
        nat_idx = np.clip(nat_idx, 0, len(NON_LEG_CODES) - 1)
        natural_rarity = NON_LEG_CODES[nat_idx]

        rarity_code = np.where(is_legendary, LENDARIO, natural_rarity).astype(np.int8)

        # --- garantias de piso de raridade ---
        trigger25 = counter25 >= 25
        trigger10 = counter10 >= 10

        upgrade_epic = (~is_legendary) & trigger25 & (rarity_code < EPICO)
        rarity_code = np.where(upgrade_epic, EPICO, rarity_code).astype(np.int8)

        upgrade_raro = (~is_legendary) & trigger10 & (rarity_code < RARO)
        rarity_code = np.where(upgrade_raro, RARO, rarity_code).astype(np.int8)

        # hard pity flag (pull 50 forcado)
        hardpity_flags[:, i] = is_legendary & (pity_counter >= 50)

        # registra primeiro lendario
        newly_first_leg = is_legendary & (first_legendary_pull == -1)
        first_legendary_pull[newly_first_leg] = i + 1

        # reset dos contadores
        counter25 = np.where(is_legendary | trigger25, 0, counter25)
        counter10 = np.where(is_legendary | trigger25 | trigger10, 0, counter10)
        pity_counter = np.where(is_legendary, 0, pity_counter)

        # --- mecanica de evento: 50/50 + garantia persistente ---
        if event_banner:
            got_via_guarantee = is_legendary & pending_featured
            r3 = rng.random(n_players)
            won_5050 = r3 < 0.5
            got_via_luck = is_legendary & (~pending_featured) & won_5050
            lost_5050 = is_legendary & (~pending_featured) & (~won_5050)

            got_featured = got_via_guarantee | got_via_luck

            pending_featured = np.where(got_via_guarantee, False, pending_featured)
            pending_featured = np.where(lost_5050, True, pending_featured)

            newly_first_feat = got_featured & (first_featured_pull == -1)
            first_featured_pull[newly_first_feat] = i + 1

        rarity_history[:, i] = rarity_code

        # --- duplicatas (roster assumido) ---
        if track_duplicates:
            for r, size in ROSTER_SIZES.items():
                mask = rarity_code == r
                players_idx = np.nonzero(mask)[0]
                if players_idx.size == 0:
                    continue
                ids = rng.integers(0, size, size=players_idx.size)
                already_owned = owned[r][players_idx, ids]
                new_char_flag[players_idx, i] = ~already_owned
                owned[r][players_idx, ids] = True

    result = {
        "rarity_history": rarity_history,
        "first_legendary_pull": first_legendary_pull,
        "hardpity_flags": hardpity_flags,
    }
    if event_banner:
        result["first_featured_pull"] = first_featured_pull
    if track_duplicates:
        result["new_char_flag"] = new_char_flag
    return result


def simulate_beginner_banner(n_players, seed):
    """
    Banner inicial (beginner): 40 pulls no total, cap fixo.
    Garantias:
      - Raro+ garantido ate o pull 10 (forcado no pull 10 se ainda nao saiu)
      - Epico+ garantido ate o pull 20 (forcado no pull 20 se ainda nao saiu)
      - Lendario garantido ate o pull 40 (forcado no pull 40 se ainda nao saiu)
    Nao ha pity suave documentado para este banner; as garantias acima ja
    limitam o pior caso.
    """
    rng = np.random.default_rng(seed)
    n_pulls = 40
    rarity_history = np.zeros((n_players, n_pulls), dtype=np.int8)

    got_rare_plus = np.zeros(n_players, dtype=bool)
    got_epic_plus = np.zeros(n_players, dtype=bool)
    got_legendary = np.zeros(n_players, dtype=bool)

    # marcos para as perguntas do relatorio
    rare_plus_within_10_natural = np.zeros(n_players, dtype=bool)
    epic_plus_within_10_natural = np.zeros(n_players, dtype=bool)

    for i in range(n_pulls):
        pull_num = i + 1
        r1 = rng.random(n_players)
        r2 = rng.random(n_players)

        is_legendary = r1 < BASE_RATES[LENDARIO]
        nat_idx = np.searchsorted(NON_LEG_CUM, r2, side="right")
        nat_idx = np.clip(nat_idx, 0, len(NON_LEG_CODES) - 1)
        natural_rarity = NON_LEG_CODES[nat_idx]
        rarity_code = np.where(is_legendary, LENDARIO, natural_rarity).astype(np.int8)

        if pull_num == 10:
            need_upgrade = (~got_rare_plus) & (rarity_code < RARO) & (~is_legendary)
            rarity_code = np.where(need_upgrade, RARO, rarity_code).astype(np.int8)
        if pull_num == 20:
            need_upgrade = (~got_epic_plus) & (rarity_code < EPICO) & (~is_legendary)
            rarity_code = np.where(need_upgrade, EPICO, rarity_code).astype(np.int8)
        if pull_num == 40:
            need_upgrade = (~got_legendary)
            rarity_code = np.where(need_upgrade, LENDARIO, rarity_code).astype(np.int8)
            is_legendary = is_legendary | need_upgrade

        got_rare_plus |= rarity_code >= RARO
        got_epic_plus |= rarity_code >= EPICO
        got_legendary |= rarity_code >= LENDARIO

        rarity_history[:, i] = rarity_code

        if pull_num == 10:
            rare_plus_within_10_natural = got_rare_plus.copy()
            epic_plus_within_10_natural = got_epic_plus.copy()

    return {
        "rarity_history": rarity_history,
        "rare_plus_within_10": rare_plus_within_10_natural,
        "epic_plus_within_10": epic_plus_within_10_natural,
        "got_epic_plus_final": got_epic_plus,
        "got_legendary_final": got_legendary,
    }


# --------------------------------------------------------------------------
# 3. ECONOMIA / RENDA SEMANAL DE FRAGMENTOS
# --------------------------------------------------------------------------

# Metas de design (equilibrado = escala 1.0). Casual e modelado como renda
# achatada (sem grande bonus unico de introducao) pois o design não pede
# tapering para esse perfil; Ativo e Dedicado tem fase "early" (semanas 1-3,
# com bonus unicos de quests/exploracao/conquistas) e fase "steady" (semana
# 4+, so fontes recorrentes).
PROFILE_TARGETS = {
    "casual":    {"early": 600,  "steady": 600},
    "ativo":     {"early": 1000, "steady": 800},
    "dedicado":  {"early": 1400, "steady": 1150},
}

SCENARIOS = {
    "conservador": 0.75,
    "equilibrado": 1.00,
    "generoso": 1.25,
}

# Proporcoes de bucket na fase early (somam 100%)
EARLY_BUCKET_SHARES = {
    "quests": 0.30,
    "diario": 0.20,
    "masmorras": 0.20,
    "exploracao": 0.10,
    "conquistas": 0.10,
    "eventos": 0.10,
}
# fontes recorrentes (existem para sempre): diario, masmorras, eventos (2:2:1)
RECURRING_KEYS = ["diario", "masmorras", "eventos"]
RECURRING_WEIGHTS = np.array([EARLY_BUCKET_SHARES[k] for k in RECURRING_KEYS])
# fontes de bonus unico (esgotam-se nas primeiras 3 semanas): quests, exploracao, conquistas
ONE_TIME_KEYS = ["quests", "exploracao", "conquistas"]
ONE_TIME_WEIGHTS = np.array([EARLY_BUCKET_SHARES[k] for k in ONE_TIME_KEYS])


def compute_economy(profile, scenario_mult):
    """
    Calcula, para um perfil e um multiplicador de cenario, os valores de:
      - renda semanal early / steady
      - pulls/semana early / steady
      - valores de cada bucket (recorrentes semanais + bonus unicos totais)
    """
    base = PROFILE_TARGETS[profile]
    early_w = base["early"] * scenario_mult
    steady_w = base["steady"] * scenario_mult

    # buckets recorrentes semanais (parte de steady_w, na mesma proporcao
    # relativa definida para a fase early)
    recurring_fracs = RECURRING_WEIGHTS / RECURRING_WEIGHTS.sum()
    recurring_amounts = dict(zip(RECURRING_KEYS, steady_w * recurring_fracs))

    # bonus unico total (recebido ao longo das semanas 1-3), calculado de
    # forma que a MEDIA semanal das primeiras 3 semanas bata com early_w:
    #   3 * early_w = 3 * steady_w (recorrente, já ativo desde a semana 1) + lump_total
    lump_total = max(0.0, 3 * (early_w - steady_w))
    one_time_fracs = ONE_TIME_WEIGHTS / ONE_TIME_WEIGHTS.sum()
    one_time_amounts = dict(zip(ONE_TIME_KEYS, lump_total * one_time_fracs))

    pulls_week_early = early_w / PULL_COST
    pulls_week_steady = steady_w / PULL_COST

    return {
        "renda_early_semana": early_w,
        "renda_steady_semana": steady_w,
        "pulls_semana_early": pulls_week_early,
        "pulls_semana_steady": pulls_week_steady,
        "buckets_recorrentes_semanais": recurring_amounts,
        "bonus_unicos_total_semanas1a3": one_time_amounts,
        "lump_total": lump_total,
    }


# --------------------------------------------------------------------------
# 4. EXECUCAO PRINCIPAL
# --------------------------------------------------------------------------

def main():
    t0 = time.time()
    N_PLAYERS = 1_000_000     # jogadores simulados por motor (>= 1M sequencias de pull)
    N_PULLS = 400              # pulls sequenciais simulados por jogador/banner
    # janela usada para medir taxas em "regime" (jogador veterano, longe do
    # inicio da conta, para evitar o viés do transiente inicial de 0-50 pulls)
    STEADY_WINDOW_OFFSET = 200
    N_PLAYERS_BEGINNER = 1_000_000

    print(f"Simulando banner PERMANENTE: {N_PLAYERS} jogadores x {N_PULLS} pulls...")
    perm = simulate_banner(N_PLAYERS, N_PULLS, seed=1, event_banner=False, track_duplicates=True)
    print(f"  -> ok ({time.time()-t0:.1f}s)")

    t1 = time.time()
    print(f"Simulando banner EVENTO: {N_PLAYERS} jogadores x {N_PULLS} pulls...")
    evt = simulate_banner(N_PLAYERS, N_PULLS, seed=2, event_banner=True, track_duplicates=False)
    print(f"  -> ok ({time.time()-t1:.1f}s)")

    t2 = time.time()
    print(f"Simulando banner INICIANTE: {N_PLAYERS_BEGINNER} jogadores x 40 pulls...")
    beg = simulate_beginner_banner(N_PLAYERS_BEGINNER, seed=3)
    print(f"  -> ok ({time.time()-t2:.1f}s)")

    # ---- metricas gerais da engine (independem de perfil/cenario) ----
    fl = perm["first_legendary_pull"]
    fl_valid = fl[fl > 0]
    stats_first_legendary = {
        "media": float(np.mean(fl_valid)),
        "p99": float(np.percentile(fl_valid, 99)),
        "max": int(np.max(fl_valid)),
        "pct_nao_obteve_em_150": float(np.mean(fl == -1) * 100),
    }

    ff = evt["first_featured_pull"]
    ff_valid = ff[ff > 0]
    stats_first_featured = {
        "media": float(np.mean(ff_valid)),
        "p99": float(np.percentile(ff_valid, 99)),
        "max": int(np.max(ff_valid)),
        "pct_nao_obteve_em_150": float(np.mean(ff == -1) * 100),
        "limite_pior_caso_teorico": 100,
    }

    # taxa de hard pity por jogador (qualquer ocorrencia no historico simulado)
    any_hardpity_150 = perm["hardpity_flags"].any(axis=1)
    pct_hardpity_150 = float(np.mean(any_hardpity_150) * 100)

    # taxa de hard pity "por pull" em regime (janela tardia, longe do viés
    # do início de conta), usada para estimar % de meses com hard pity de
    # jogadores veteranos via aproximacao 1-(1-rate)^pulls_no_mes
    steady_hardpity_rate_per_pull = float(
        np.mean(perm["hardpity_flags"][:, STEADY_WINDOW_OFFSET:])
    )
    # taxa de personagem "novo" por pull em regime (janela tardia)
    steady_new_char_rate_per_pull = float(
        np.mean(perm["new_char_flag"][:, STEADY_WINDOW_OFFSET:])
    )

    # ---- banner iniciante ----
    beg_stats = {
        "pct_rare_plus_within_10_pulls": float(np.mean(beg["rare_plus_within_10"]) * 100),
        "pct_epic_plus_within_10_pulls": float(np.mean(beg["epic_plus_within_10"]) * 100),
        "pct_epic_plus_within_20_pulls": float(np.mean(beg["got_epic_plus_final"]) * 100),
        "pct_legendary_within_40_pulls": float(np.mean(beg["got_legendary_final"]) * 100),
    }

    # ---- economia por perfil x cenario ----
    economy_results = {}
    for scenario, mult in SCENARIOS.items():
        economy_results[scenario] = {}
        for profile in PROFILE_TARGETS:
            econ = compute_economy(profile, mult)

            pw_early = econ["pulls_semana_early"]
            pw_steady = econ["pulls_semana_steady"]

            # pulls acumulados no "mes 1" (3 semanas early + 1.3 semanas steady)
            pulls_month1 = pw_early * 3 + pw_steady * 1.3
            # pulls num "mes em regime" (4.3 semanas steady)
            pulls_month_steady = pw_steady * 4.3

            pulls_month1_int = max(1, int(round(pulls_month1)))
            pulls_month_steady_int = max(1, int(round(pulls_month_steady)))
            pulls_month1_int = min(pulls_month1_int, N_PULLS)
            pulls_month_steady_int = min(pulls_month_steady_int, STEADY_WINDOW_OFFSET)

            # mes 1: jogador comeca do zero, entao usamos a janela real desde
            # o pull 1 do historico simulado (captura corretamente o viés de
            # conta nova = pity counter comeca em 0)
            pct_hardpity_month1 = float(
                np.mean(perm["hardpity_flags"][:, :pulls_month1_int].any(axis=1)) * 100
            )

            # meses em regime (jogador veterano, ja jogou varios meses):
            # aproximamos via taxa por pull medida numa janela tardia do
            # historico simulado (longe do transiente inicial), assumindo
            # que a posicao do jogador dentro do ciclo de pity, em regime,
            # se comporta como a media de longo prazo (ergodicidade).
            pct_hardpity_month_steady = float(
                1 - (1 - steady_hardpity_rate_per_pull) ** pulls_month_steady_int
            ) * 100

            avg_new_month = steady_new_char_rate_per_pull * pulls_month_steady_int
            avg_dup_month = pulls_month_steady_int - avg_new_month

            # mes 1 (roster ainda pouco explorado, janela desde o pull 1)
            new_in_month1 = perm["new_char_flag"][:, :pulls_month1_int].sum(axis=1)
            avg_new_month1 = float(np.mean(new_in_month1))
            avg_dup_month1 = float(pulls_month1_int - avg_new_month1)

            economy_results[scenario][profile] = {
                **econ,
                "pulls_mes1_estimado": pulls_month1,
                "pulls_mes_regime_estimado": pulls_month_steady,
                "pct_hardpity_mes1": pct_hardpity_month1,
                "pct_hardpity_mes_regime": pct_hardpity_month_steady,
                "media_personagens_novos_mes_regime": avg_new_month,
                "media_duplicatas_mes_regime": avg_dup_month,
                "media_personagens_novos_mes1": avg_new_month1,
                "media_duplicatas_mes1": avg_dup_month1,
            }

    # ---- sub-simulacao: bonus pontual de +300 fragmentos ----
    bonus_note = {}
    for profile in PROFILE_TARGETS:
        econ = compute_economy(profile, 1.0)
        extra_pulls = 300 / PULL_COST
        pw_steady = econ["pulls_semana_steady"]
        bonus_note[profile] = {
            "pulls_semana_normal": pw_steady,
            "pulls_semana_com_bonus": pw_steady + extra_pulls,
            "semanas_economizadas_para_50_pulls": (50 / pw_steady) - (50 / (pw_steady + extra_pulls)),
        }

    output = {
        "meta": {
            "n_players_engine": N_PLAYERS,
            "n_pulls_engine": N_PULLS,
            "n_players_beginner": N_PLAYERS_BEGINNER,
            "tempo_total_s": time.time() - t0,
        },
        "engine_stats": {
            "primeiro_lendario": stats_first_legendary,
            "primeiro_featured_evento": stats_first_featured,
            "pct_hardpity_em_150_pulls": pct_hardpity_150,
            "roster_assumido": {RARITY_NAMES[k]: v for k, v in ROSTER_SIZES.items()},
        },
        "banner_iniciante": beg_stats,
        "economia": economy_results,
        "bonus_pontual_300": bonus_note,
    }

    with open("/home/claude/rpg-game/scripts/gacha_sim/results.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nTotal: {time.time()-t0:.1f}s")
    print("Resultados escritos em results.json")

    # resumo rapido no console
    print("\n=== RESUMO RAPIDO ===")
    print(f"Primeiro lendario: media={stats_first_legendary['media']:.1f} pulls, "
          f"p99={stats_first_legendary['p99']:.1f}, max={stats_first_legendary['max']}")
    print(f"Featured garantido (evento): media={stats_first_featured['media']:.1f} pulls, "
          f"p99={stats_first_featured['p99']:.1f}, max={stats_first_featured['max']} "
          f"(limite teorico pior caso=100)")
    print(f"% jogadores que bateram hard pity em 150 pulls: {pct_hardpity_150:.2f}%")
    print(f"Banner iniciante: Raro+ em 10 pulls = {beg_stats['pct_rare_plus_within_10_pulls']:.1f}% "
          f"(deve ser 100% por garantia); Epico+ em 10 pulls (natural) = "
          f"{beg_stats['pct_epic_plus_within_10_pulls']:.1f}%")

    return output


if __name__ == "__main__":
    main()
