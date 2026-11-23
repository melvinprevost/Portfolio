# Portfolio 3D — Melvin Prévost

Bureau de nuit en 3D (Three.js) : Melvin de dos devant trois écrans. Depuis le bureau, chaque écran affiche un avant-goût ; un clic fait entrer la caméra et le contenu s'affiche directement dans le moniteur (CSS3D, interactif). Sur téléphone, une version dédiée cadre un moniteur à la fois ; des cartes à faire défiler au doigt servent d'avant-goût et le contenu s'ouvre dans un panneau qui monte depuis le bas (pastille rouge, glisser vers le bas ou geste retour pour fermer).

| Écran | Contenu |
|---|---|
| Gauche | Parcours : expériences et formations |
| Centre | Profil : terminal `whoami`, compétences, contact |
| Droite | CreaVizione : services, réalisations, liens |

## Personnage

Modèle « Leonard » et animation « Typing » issus de [Mixamo](https://www.mixamo.com) (Adobe), convertis en GLB allégé (`assets/leonard-typing.glb`, ~3,3 Mo). Le personnage procédural de `js/scene.js` ne sert plus que de secours si le modèle ne se charge pas.

## Lampe de bureau

Modèle « [Desk Lamp Arm 01](https://polyhaven.com/a/desk_lamp_arm_01) » de Poly Haven (modélisation : Kuutti Siitonen), sous licence CC0, regroupé en un seul GLB (`assets/desk-lamp.glb`, ~2,9 Mo, textures 1k). La lampe procédurale sert de secours si le modèle ne se charge pas.

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
