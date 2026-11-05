# Mekanism Fission Reactor Builder

Application web pour concevoir des réacteurs à fission Mekanism **1.18.2**, compatible import/export **JEMM**.

## Lancer

```bash
cd fission-reactor-builder
python -m http.server 8766
```

Ouvrir [http://localhost:8766/](http://localhost:8766/)

## Textures 3D (optionnel)

```powershell
.\scripts\fetch-textures.ps1
```

Sans textures, l'aperçu 3D affiche des couleurs de secours.

## Fonctions

- Grille 2D (plan intérieur JEMM), import/export JSON
- Stats, refroidissement (ports, eau/sodium, condensers)
- Coût Fissile Fuel + nombre de machines pour production continue
- Aperçu 3D Three.js
