param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Name)
$ErrorActionPreference = 'Stop'
if ($Name -notmatch '^[a-z]+$') { throw 'Invalid asset name' }
Add-Type -AssemblyName System.Drawing
# O nome do assembly muda conforme a edicao do PowerShell: "System.Drawing.Common"
# so existe no PowerShell 7. Esta maquina tem apenas o Windows PowerShell 5.1,
# onde o tipo mora em System.Drawing.dll — e o Add-Type morria com "Nao foi
# possivel encontrar o arquivo de metadados" antes de gerar um unico pixel.
# Referenciar o assembly ja carregado pelo CAMINHO resolve nas duas edicoes.
$refDrawing = [System.Drawing.Bitmap].Assembly.Location
if (-not ('CityArtBounds' -as [type])) {
Add-Type -ReferencedAssemblies $refDrawing -TypeDefinition @'
using System.Drawing;
public static class CityArtBounds {
  public static Rectangle Find(Bitmap b) {
    int l=b.Width,t=b.Height,r=0,d=0;
    for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++) {
      if(b.GetPixel(x,y).A>32) {
        l=System.Math.Min(l,x);r=System.Math.Max(r,x);
        t=System.Math.Min(t,y);d=System.Math.Max(d,y);
      }
    }
    if(l>=r) throw new System.Exception("Empty image");
    return new Rectangle(l,t,r-l+1,d-t+1);
  }
}
'@
}
$dest = Join-Path $PSScriptRoot '../assets/props/cidades-v3'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$src = [System.Drawing.Bitmap]::new($Source)
try {
  $bounds=[CityArtBounds]::Find($src)
  # Normalize export only: retain generated colors/alpha; no hand-painted edits.
  # 128 logical pixels, integer 4x export. Bottom margin aligns to ground anchor.
  $small = [System.Drawing.Bitmap]::new(128,128)
  $g = [System.Drawing.Graphics]::FromImage($small)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($src,[System.Drawing.Rectangle]::new(2,2,124,124),$bounds,[System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $out = [System.Drawing.Bitmap]::new(512,512)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($small,0,0,512,512)
  $g.Dispose()
  $path=Join-Path $dest "$Name.png"
  $out.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose(); $small.Dispose()
  Get-Item -LiteralPath $path | Select-Object Name,Length
} finally { $src.Dispose() }
