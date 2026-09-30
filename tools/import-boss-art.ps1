param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Name,
  [int]$Size = 256,
  [int]$Grade = 4,
  [int]$Limiar = 128
)
# Importa a arte de UM chefe para assets/arte_v2/, NA GRADE DO JOGO.
#
# POR QUE ESTE ARQUIVO FOI REESCRITO
# ----------------------------------
# A versão anterior (minha) ampliava com bicúbico e não conferia grade
# nenhuma. O comentário dela afirmava que "resolução plena" era o contrato,
# apoiado em medir dois arquivos do próprio arte_v2. Medir dentro do arte_v2
# só prova como o arte_v2 é — não prova que ele está certo.
#
# A medição ampla, do projeto inteiro, diz o contrário:
#
#   pasta            grade 4   grade 1   borda macia (mediana)
#   icons                207         0     0,0%
#   sprites              253        43     0,0%
#   props + cidades       21         6     ~2%
#   tiles                  3         0     0,0%
#   arte_v2                0        66     6,5%     <- a exceção
#
# São 484 arquivos na grade de 4 px com alfa praticamente binário, contra 66
# criaturas fora dela. (Os 45 de sprites_hd são 64x64 nativos: em resolução
# base não existe grade a conferir, então grade 1 ali é o certo.) O padrão do
# jogo é pixel art na grade de 4; o arte_v2 é a dívida.
#
# Gerar as 26 artes que faltam com o script antigo somava 26 arquivos à
# dívida em vez de 26 arquivos ao padrão. Por isso o conserto vem antes.
#
# O QUE MUDOU, EM TRÊS PASSOS
# ---------------------------
#   1. REDUZ para a resolução LÓGICA (Size / Grade — 64 px lógicos num chefe
#      de 256). Redução é média de pixels: bicúbico é o filtro certo AQUI,
#      porque está juntando detalhe, não inventando.
#   2. BINARIZA o alfa no limiar. É isto que apaga a orla macia de 6,5% que
#      denuncia arte gerada no meio de um jogo de pixel art.
#   3. AMPLIA por VIZINHO MAIS PRÓXIMO. Cada pixel lógico vira um bloco
#      GradexGrade de cor constante — a definição de estar na grade.
#
# O desenho nunca é rotacionado nem espelhado, e o encaixe é PROPORCIONAL: um
# chefe largo não pode ser espremido para caber num quadrado. Ele fica
# ancorado embaixo, porque na batalha é desenhado a partir do pé.
#
# O ícone de 64 é 16 px lógicos ampliados 4x — exatamente o que os 207
# arquivos de assets/icons já são.
#
# Uso:  powershell -ExecutionPolicy Bypass -File tools/import-boss-art.ps1 -Source C:\...\exec-xxxx.png -Name mob_veia_negra
#       (chefe comum de 192: passe -Size 192)
# Depois:  node scripts/test-arte-grade.mjs
$ErrorActionPreference = 'Stop'
if ($Name -notmatch '^mob_[a-z0-9_]+$') { throw "Nome invalido: use a chave do sprite, ex. mob_veia_negra" }
if ($Size -ne 256 -and $Size -ne 192) { throw "Size deve ser 256 (chefe) ou 192 (comum)" }
if ($Size % $Grade -ne 0) { throw "Size ($Size) precisa ser multiplo da grade ($Grade)" }
Add-Type -AssemblyName System.Drawing

# O NOME DO ASSEMBLY MUDA CONFORME A EDICAO DO POWERSHELL.
#
# A versao anterior deste arquivo pedia "System.Drawing.Common" por nome. Esse
# assembly so existe no PowerShell 7 (.NET Core). Nesta maquina so ha o
# Windows PowerShell 5.1, onde o tipo mora em System.Drawing.dll na GAC — e o
# script MORRIA no Add-Type com "Nao foi possivel encontrar o arquivo de
# metadados". Ou seja: ele nunca chegou a gerar uma imagem sequer.
#
# Referenciar pelo CAMINHO do assembly ja carregado resolve nas duas edicoes:
# no 5.1 aponta para System.Drawing.dll, no 7 para System.Drawing.Common.dll.
$refDrawing = [System.Drawing.Bitmap].Assembly.Location

if (-not ('BossArtImg' -as [type])) {
Add-Type -ReferencedAssemblies $refDrawing -TypeDefinition @'
using System.Drawing;
public static class BossArtImg {
  // Caixa do desenho: o menor retangulo que contem tudo que nao e transparente.
  public static Rectangle Find(Bitmap b) {
    int l=b.Width,t=b.Height,r=0,d=0;
    for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++) {
      if(b.GetPixel(x,y).A>32) {
        l=System.Math.Min(l,x);r=System.Math.Max(r,x);
        t=System.Math.Min(t,y);d=System.Math.Max(d,y);
      }
    }
    if(l>=r) throw new System.Exception("Imagem vazia ou sem transparencia: o gerador devolveu fundo opaco");
    return new Rectangle(l,t,r-l+1,d-t+1);
  }
  // Alfa binario: ou o pixel esta, ou nao esta. Sem orla macia.
  public static void Binarizar(Bitmap b, int limiar) {
    for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++) {
      Color c = b.GetPixel(x,y);
      b.SetPixel(x,y, c.A >= limiar ? Color.FromArgb(255,c.R,c.G,c.B) : Color.FromArgb(0,0,0,0));
    }
  }
  // Confere que a imagem e composta por blocos NxN de cor constante.
  public static bool NaGrade(Bitmap b, int n) {
    if (b.Width % n != 0 || b.Height % n != 0) return false;
    for(int by=0;by<b.Height;by+=n) for(int bx=0;bx<b.Width;bx+=n) {
      Color c0 = b.GetPixel(bx,by);
      for(int dy=0;dy<n;dy++) for(int dx=0;dx<n;dx++)
        if(b.GetPixel(bx+dx,by+dy) != c0) return false;
    }
    return true;
  }
}
'@
}

function Reduzir([System.Drawing.Bitmap]$fonte, [System.Drawing.Rectangle]$caixa, [int]$lado, [int]$margem) {
  # Encaixe proporcional em resolucao LOGICA, ancorado embaixo.
  $util = $lado - ($margem * 2)
  $escala = [Math]::Min($util / $caixa.Width, $util / $caixa.Height)
  $w = [Math]::Max(1, [int][Math]::Round($caixa.Width * $escala))
  $h = [Math]::Max(1, [int][Math]::Round($caixa.Height * $escala))
  $x = [int][Math]::Round(($lado - $w) / 2)
  $y = $lado - $margem - $h
  $alvo = [System.Drawing.Bitmap]::new($lado, $lado)
  $g = [System.Drawing.Graphics]::FromImage($alvo)
  # Reducao: bicubico junta detalhe, e o que se quer ao encolher.
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($fonte, [System.Drawing.Rectangle]::new($x, $y, $w, $h), $caixa, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $alvo
}

function Ampliar([System.Drawing.Bitmap]$logico, [int]$fator) {
  $alvo = [System.Drawing.Bitmap]::new($logico.Width * $fator, $logico.Height * $fator)
  $g = [System.Drawing.Graphics]::FromImage($alvo)
  # Ampliacao: VIZINHO MAIS PROXIMO. Half evita o deslocamento de meio pixel
  # que borraria a borda de cada bloco e quebraria a grade.
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.DrawImage($logico, 0, 0, $alvo.Width, $alvo.Height)
  $g.Dispose()
  return $alvo
}

$dest = Join-Path $PSScriptRoot '../assets/arte_v2'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$src = [System.Drawing.Bitmap]::new($Source)
try {
  $caixa = [BossArtImg]::Find($src)

  # --- peca de combate: Size/Grade px logicos, ampliados Grade vezes ---
  $ladoLogico = $Size / $Grade
  $logico = Reduzir $src $caixa $ladoLogico 1
  [BossArtImg]::Binarizar($logico, $Limiar)
  $out = Ampliar $logico $Grade
  if (-not [BossArtImg]::NaGrade($out, $Grade)) { throw "FALHOU: a peca de combate nao ficou na grade de $Grade px" }
  $caminho = Join-Path $dest "$Name.png"
  $out.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)

  # --- icone de 64: 16 px logicos ampliados 4x, como os 207 de assets/icons ---
  $icoLogico = Reduzir $src $caixa 16 0
  [BossArtImg]::Binarizar($icoLogico, $Limiar)
  $ico = Ampliar $icoLogico 4
  if (-not [BossArtImg]::NaGrade($ico, 4)) { throw "FALHOU: o icone nao ficou na grade de 4 px" }
  $caminhoIco = Join-Path $dest "${Name}_icon.png"
  $ico.Save($caminhoIco, [System.Drawing.Imaging.ImageFormat]::Png)

  $logico.Dispose(); $icoLogico.Dispose(); $out.Dispose(); $ico.Dispose()
  Get-Item -LiteralPath $caminho, $caminhoIco | Select-Object Name, Length
  Write-Host "Na grade de $Grade px, alfa binario. Confira:  node scripts/test-arte-grade.mjs"
} finally { $src.Dispose() }
