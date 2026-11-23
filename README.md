# Portfolio 3D

Un portfolio interactif en 3D : un bureau de nuit, vu de dos, avec trois écrans à explorer.

**[Visiter le portfolio →](https://nxritsu.github.io/Portfolio/)**

[![Aperçu du portfolio](assets/og-image.jpg)](https://nxritsu.github.io/Portfolio/)

## Le concept

Pas de CV figé : on entre dans un bureau. Chaque écran montre un avant-goût animé de son contenu. Un clic rapproche la caméra, un second ouvre la fenêtre directement dans le moniteur, et la pastille rouge ramène au bureau.

| Écran | Contenu |
|---|---|
| Parcours | Expériences et formations |
| Profil | Présentation façon terminal, compétences, contact |
| CreaVizione | Présentation de mon activité web, avec un lien vers le site |

### Sur téléphone

Une version pensée pour le tactile : la caméra cadre un moniteur à la fois, des cartes défilent au doigt sous la scène, et le contenu s'ouvre dans un panneau qui monte depuis le bas. On le ferme avec la pastille rouge, en le glissant vers le bas ou avec le geste retour.

## Technologies

- **[Three.js](https://threejs.org)** (WebGL) : scène, lumières, ombres, bloom et tone mapping
- **CSS3DRenderer** : les fenêtres HTML s'affichent dans les moniteurs en 3D, tout en restant du vrai HTML (texte sélectionnable, liens, défilement)
- **Canvas 2D** : textures animées des écrans (avant-goûts)
- **glTF / GLB** : personnage animé et lampe de bureau
- HTML, CSS et JavaScript (modules ES), **sans framework ni build**
- Hébergement statique sur **GitHub Pages**

### Quelques détails

- Le personnage est calé automatiquement sur son animation : le clavier se place sous ses doigts et la souris suit sa paume. La souris est modélisée d'après la forme mesurée de la main.
- Les textures des écrans sont dessinées en temps réel (terminal qui tape, puces qui s'allument, bouton qui pulse).
- Les modèles 3D sont chargés en arrière-plan. Si l'un d'eux ne se charge pas, une version procédurale prend le relais.

## Performances

Le site doit rester fluide sans faire chauffer la machine :

- **Rendu à la demande** : 60 images/s seulement quand quelque chose bouge (caméra, souris, tactile), 30 au repos, 20 quand la fenêtre n'a pas le focus et 10 derrière le panneau téléphone. Jamais plus de 60, même sur un écran 120 Hz, et plus rien quand l'onglet est caché.
- **Rendu allégé** : résolution plafonnée à 1,5× et abaissée automatiquement si l'appareil ne suit pas ; bloom en demi-résolution ; ombres recalculées une image sur deux ; aucun GPU « haute performance » forcé.
- **Chargement léger** : environ 2,3 Mo de modèles. Le personnage est compressé (`KHR_mesh_quantization`) et la lampe utilise des textures 512 px. Tout se télécharge en parallèle dès l'ouverture de la page.

## Lancer en local

Le site doit être servi en HTTP (les modules ES ne fonctionnent pas en `file://`) :

```bash
python3 -m http.server 5173
```

Puis ouvrir <http://localhost:5173>.

## Structure

```
index.html          HUD, cartes téléphone et contenu HTML des trois fenêtres
css/style.css       styles (bureau, fenêtres, version téléphone)
js/main.js          rendu, caméra, navigation entre écrans, cadence et calage du personnage
js/scene.js         pièce, bureau, moniteurs, lumières, souris, éléments de secours
js/screens.js       textures animées des écrans et néon
assets/             modèles GLB, image d'aperçu et icônes
```

## Crédits

- Personnage « Leonard » et animation « Typing » : [Mixamo](https://www.mixamo.com) (Adobe)
- Lampe « [Desk Lamp Arm 01](https://polyhaven.com/a/desk_lamp_arm_01) » : [Poly Haven](https://polyhaven.com), licence CC0
- Moteur 3D : [Three.js](https://threejs.org), licence MIT
- Polices : Inter, JetBrains Mono, Space Grotesk, Josefin Sans et Tilt Neon via [Google Fonts](https://fonts.google.com)

## Utilisation

Ce dépôt est public pour montrer le travail réalisé. Le contenu du portfolio (textes, parcours, identité) est personnel : merci de ne pas le reprendre tel quel. Les modèles tiers restent soumis à leurs licences respectives.
