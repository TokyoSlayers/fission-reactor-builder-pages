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

## Démo en ligne (GitHub Pages)

https://tokyoslayers.github.io/fission-reactor-builder-pages/

Code source privé : [`fission-reactor-builder`](https://github.com/TokyoSlayers/fission-reactor-builder) — site public via [`fission-reactor-builder-pages`](https://github.com/TokyoSlayers/fission-reactor-builder-pages).

Republier après changement :

```powershell
git push origin main
git push https://github.com/TokyoSlayers/fission-reactor-builder-pages.git main:main
```

## Fonctions

- Grille 2D (plan intérieur JEMM), import/export JSON
- Stats, refroidissement (ports, eau/sodium, condensers)
- Coût Fissile Fuel + nombre de machines pour production continue
- Aperçu 3D Three.js
