# Quatro classes adicionais — implementação local

## Conteúdo integrado

- Paladino, Bardo, Druida e Necromante na criação, em todas as seis raças.
- Duas habilidades iniciais por classe e três ramos com 18 nós cada.
- 72 nós de habilidades no total (24 ativos e 48 passivos).
- 48 talentos de classe/subclasse e oito especializações.
- 32 convocados novos em duas levas: oito por classe (dois comuns, dois incomuns, dois raros e dois épicos), com despertar no nível 12. Mantidas as quotas por raridade e probabilidades do gacha.
- Segunda leva: 16 artes exclusivas em PNG transparente, geradas individualmente com image_gen e integradas à ficha, batalha e ordem de turno. Prompts e caminhos em gacha-16-artes-prompts.json.
- Artes grandes da segunda leva carregadas sob demanda, sem baixar o lote de aproximadamente 20 MB no início da partida.
- Afinidades: Humano inclui as quatro novas classes; Anão/Paladino, Halfling/Bardo, Elfo/Druida e Draconato/Necromante usam os bônus raciais já existentes.
- Sem mudança de limite do time, nível máximo 25 ou teto de poder individual 250.

## Mecânicas

- Paladino: interceptação limitada a 30%, sem cadeias recursivas entre protetores. O protetor pode morrer ao absorver dano.
- Bardo: uma canção ativa por fonte. Cantar outra remove o efeito anterior desse bardo.
- Druida: postura animal temporária, ataque básico baseado em INT e cura bloqueada enquanto transformado. Não altera permanentemente atributos.
- Necromante: servo temporário age após ataques do dono, sem vaga ou ATB independente; não age com dono morto. Drenagem limitada à vida realmente retirada.
- Automático conhece posturas novas; cartas de suporte não exigem selecionar um inimigo.

## Balanceamento inicial

- Cinco pontos totais de crescimento por nível para cada classe.
- Iniciativa base passa a 8 + 60% da Destreza, arredondada, antes de equipamento e bônus racial. Evita suportes com turnos extremamente raros.
- Conjuradores recuperam 2% do Éter máximo, mínimo 1, ao fim do próprio turno.
- Migração idempotente ajusta apenas os deltas de crescimento de personagens antigos, sem remover itens, talentos ou bônus narrativos e sem ressuscitar personagens.
- Diagnóstico: 192 candidatos, níveis 5/15/25, três cenários, 24 sementes por condição = 41.472 combates simulados (motor, não jogadores humanos).
- Resultado é calibração inicial, não comprovação de equilíbrio em todas as builds. A bateria não compra talentos nem usa consumíveis ou despertar. Apoio fixo pode favorecer/punir certas funções.

## Validação e pendências

- Testes de integração das 24 combinações novas e 32 convocados passaram.
- Segunda leva validada com 20.000 invocações do motor completo, imagens únicas com canal alpha, evolução ao nível 25 e carregamento sob demanda.
- Teste do registro de artes: 35 verificações passaram. Corrigida a compatibilidade Windows do próprio teste.
- Testes da IA automática e os 26 testes de navegação/equipamento passaram.
- Cards: 65 verificações passaram e quatro falharam. As mesmas quatro falhas foram reproduzidas carregando os módulos JavaScript do HEAD anterior: imunidade elemental (três assertivas) e bioma de masmorra.
- Arte exclusiva dos 16 convocados da segunda leva concluída. Os 16 convocados da primeira leva e a caminhada das novas classes ainda usam fallback explícito; não são 32 artes exclusivas.
- Transformação e servo têm efeitos de combate e registro, mas ainda não têm animações/sprites exclusivos.
- Navegador local: dez classes visíveis na criação; ficha e batalha reais conferidas em página isolada sem gravar saves. Corrigidas prioridades que substituíam a arte gacha por raça/classe no campo e na ordem de turno.
- Falta validação mobile completa e testes de balanceamento com múltiplas composições e árvores compradas. O diagnóstico não demonstra equilíbrio universal.
- Não publicado, não commitado nesta etapa.
