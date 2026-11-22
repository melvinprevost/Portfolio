# Portfolio 3D — Melvin Prévost

Bureau de nuit en 3D (Three.js) : Melvin de dos devant trois écrans. Un clic sur un écran fait entrer la caméra dedans.

| Écran | Contenu |
|---|---|
| Gauche | Parcours : expériences et formations |
| Centre | Profil : terminal `whoami`, compétences, contact |
| Droite | CreaVizione : services, réalisations, liens |

## Lancer en local

```bash
python3 -m http.server 5173
```

Puis ouvrir http://localhost:5173.

## Structure

- `index.html` : HUD et contenu HTML des 3 écrans (panneaux)
- `css/style.css` : styles (le panneau CreaVizione reprend la charte du site)
- `js/main.js` : rendu, caméra, zoom dans les écrans, survol et clic
- `js/scene.js` : pièce, bureau, moniteurs, chaise, personnage, lumières
- `js/screens.js` : textures animées affichées sur les moniteurs

Aucun build : site statique, déployable tel quel sur GitHub Pages.
