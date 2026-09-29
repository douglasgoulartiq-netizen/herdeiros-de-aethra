param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Name,
  [int]$Size = 256
)
# Importa a arte de UM chefe para assets/arte_v2/.
#
# Irmão de import-city-art.ps1, com duas diferenças que vêm do contrato do
# jogo (src/data/assetRegistry.js), não de gosto:
#
#   1. TAMANHO. Prop de cidade sai em 128 pixels lógicos ampliados 4x. Criatura
#      NÃO: a arte_v2 que já está no projeto é 256x256 em resolução plena
#      (medido: nenhum bloco NxN constante em mob_arauto_das_cinzas.png nem em
#      mob_dragao_anciao_das_cinzas.png). Ampliar por vizinho mais próximo aqui
#      deixaria o chefe novo com metade do detalhe dos 23 que já existem.
#   2. DUAS PEÇAS. Todo monstro em arte_v2 tem <id>.png (combate) e
#      <id>_icon.png (retrato de 64). O ícone é redução da MESMA imagem — foi
#      conferido: a cobertura de alfa das duas bate em 0,001.
#
# O desenho nunca é rotacionado nem espelhado, e o encaixe é PROPORCIONAL: um
# chefe largo não pode ser espremido para caber num quadrado.
#
# Uso:  pwsh tools/import-boss-art.ps1 -Source C:\...\exec-xxxx.png -Name mob_veia_negra
#       (chefe comum de 192: passe -Size 192)
$ErrorActionPreference = 'Stop'
if ($Name -notmatch '^mob_[a-z0-9_]+$') { throw "Nome invalido: use a chave do sprite, ex. mob_veia_negra" }
if ($Size -ne 256 -and $Size -ne 192) { throw "Size deve ser 256 (chefe) ou 192 (comum)" }
Add-Type -AssemblyName System.Drawing
if (-not ('BossArtBounds' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing.Common,System.Drawing.Primitives -TypeDefinition @'
using System.Drawing;
public static class BossArtBounds {
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
}
'@
}
$dest = Join-Path $PSScriptRoot '../assets/arte_v2'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$src = [System.Drawing.Bitmap]::new($Source)
try {
  $bounds = [BossArtBounds]::Find($src)

  # Encaixe proporcional dentro do quadrado, com 2 px de margem de cada lado.
  # O chefe fica ancorado embaixo: na batalha ele é desenhado a partir do pé,
  # e centralizar verticalmente faria bicho de pernas curtas flutuar.
  $util = $Size - 4
  $escala = [Math]::Min($util / $bounds.Width, $util / $bounds.Height)
  $w = [int][Math]::Round($bounds.Width * $escala)
  $h = [int][Math]::Round($bounds.Height * $escala)
  $x = [int][Math]::Round(($Size - $w) / 2)
  $y = $Size - 2 - $h

  $out = [System.Drawing.Bitmap]::new($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, [System.Drawing.Rectangle]::new($x, $y, $w, $h), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $caminho = Join-Path $dest "$Name.png"
  $out.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)

  # Ícone: redução da peça de combate já montada, para as duas serem a mesma
  # silhueta no mesmo enquadramento.
  $ico = [System.Drawing.Bitmap]::new(64, 64)
  $g2 = [System.Drawing.Graphics]::FromImage($ico)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g2.DrawImage($out, 0, 0, 64, 64)
  $g2.Dispose()
  $caminhoIco = Join-Path $dest "${Name}_icon.png"
  $ico.Save($caminhoIco, [System.Drawing.Imaging.ImageFormat]::Png)

  $out.Dispose(); $ico.Dispose()
  Get-Item -LiteralPath $caminho, $caminhoIco | Select-Object Name, Length
  Write-Host "Agora confira a cobertura:  node scripts/test-arte-chefes.mjs"
} finally { $src.Dispose() }
