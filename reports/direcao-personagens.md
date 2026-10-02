# Direção dos personagens

Referência oficial: `assets/sprites/walk_v2_pc_humano_guerreiro.png`, uma figura por vez. Proporção heroica compacta de aproximadamente 4,5 cabeças; diferenças anatômicas de raça preservadas. Essa referência rege o acabamento, não a roupa nem o rosto dos outros heróis.

1. Padrão: clusters legíveis, contorno seletivo escuro, três sombras principais por material, iluminação superior consistente, fundo transparente.
2. Silhueta: classe identificável por postura e equipamento. Arma e roupa derivadas da descrição no roster; não deduzir gênero apenas pelo nome. Uma figura inteira, sem partes cortadas.
3. Enquadramento: corpo cabe em 90% do quadro, pés na linha de 95%, escala uniforme sem esticar proporções. Anões e halflings mantêm porte menor na batalha. Recorte alfa calculado uma vez por imagem e guardado em cache.
4. Retrato: rosto e ombros derivados da fonte oficial. Não trocar por rosto genérico. Conferir separadamente armas elevadas e chapéus altos.
5. Personalidade: expressão, postura, marcas e acessórios obedecem à descrição e facção no roster. Nomes de armas despertadas são referências de tema, não uma concessão mecânica do item.
6. Animação: respiração ancorada nos pés; ação física, disparo e conjuração com movimentos distintos; impacto e vitória curtos. Barras e nomes ficam imóveis. Movimento reduzido deve desativar transformações. São animações da ilustração, não novos desenhos anatômicos de cada golpe.
7. Raridade: ornamento e um detalhe luminoso localizado nas peças raras. Moldura/selo discreto nos cards; nunca uma aura que encubra vizinhos. Não altera atributos ou raridade do personagem.

Limites: geração não garante continuidade pixel a pixel entre poses; expressões/armas exigem revisão visual. Retratos derivados não acrescentam detalhes ausentes no original. A geração de novos quadros de ataque/despertar é uma produção adicional, não está implícita nas transformações de animação.

Escopo: protagonistas e convocados. Cenários, monstros e chefes continuam com os arquivos existentes.

## Entrega desta rodada

- 60 folhas de caminhada oficiais para protagonista (raça/classe, quatro direções),
  com enquadramento intrínseco e testes automatizados.
- 94 artes oficiais de convocados em `assets/arte_v3/`, referenciadas como WebP
  sem perda visível. Os PNGs de origem permanecem no PC para revisão e não entram
  no bundle de produção.
- Compressão verificada por dimensões, transparência e pixels visíveis: 147.884.501
  bytes em PNG para 116.381.546 bytes em WebP (21% menor).
- A batalha agora diferencia autoataque, habilidade, suporte, crítico e elemento
  na mesma linha temporal preparo → contato → impacto → retorno. O botão de pular
  e o movimento reduzido continuam disponíveis.

### Prompt-base usado nas artes

Uma única personagem jogável em corpo inteiro, vista frontal 3/4, fundo transparente,
pixel-art refinado e legível em escala pequena, contorno escuro seletivo, três valores
de sombra por material, iluminação superior consistente, silhueta clara de `classe`,
raça `raça`, equipamento e personalidade descritos em `lore`. Proporção compacta de
aproximadamente 4,5 cabeças, pés completos dentro do quadro, sem texto, interface,
cenário, moldura ou aura. Um detalhe de acabamento correspondente à raridade
`raridade`, sem obscurecer a silhueta.
