$Port = 8766
Set-Location $PSScriptRoot
Write-Host "Fission Reactor Builder -> http://localhost:$Port/"
python -m http.server $Port
