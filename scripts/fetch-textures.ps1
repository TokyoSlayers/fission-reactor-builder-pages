# Télécharge les textures Mekanism 1.18.x pour l'aperçu 3D
$base = "https://raw.githubusercontent.com/mekanism/Mekanism/1.18.x/src/main/resources/assets/mekanism/textures/block"
$out = Join-Path $PSScriptRoot "..\assets\textures"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$files = @{
  "fission_reactor_casing.png" = "$base/fission_reactor_casing.png"
  "fission_reactor_glass.png" = "$base/fission_reactor_glass.png"
  "fission_fuel_assembly.png" = "$base/fission_fuel_assembly.png"
  "control_rod_assembly.png" = "$base/control_rod_assembly.png"
  "fission_reactor_port.png" = "$base/fission_reactor_port.png"
}

foreach ($name in $files.Keys) {
  $dest = Join-Path $out $name
  try {
    Invoke-WebRequest -Uri $files[$name] -OutFile $dest -UseBasicParsing
    Write-Host "OK $name"
  } catch {
    Write-Warning "Failed $name - 3D preview will use fallback colors."
  }
}
