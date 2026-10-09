# La pyramide de Ponzi — expliquée en 1 minute

Animation motion design **verticale 9:16 (1080 × 1920, 60 i/s, 60 s)** pour TikTok, Instagram Reels et YouTube Shorts.
Objectif : qu'une personne sans aucune notion de finance comprenne le mécanisme en un seul visionnage.

| Fichier | Usage |
| --- | --- |
| `output/pyramide-de-ponzi.mp4` | **Vidéo finale** : H.264 + AAC, musique et bruitages, −14 LUFS |
| `output/pyramide-de-ponzi-sans-musique.mp4` | Même vidéo avec les bruitages seuls, pour poser un son tendance dans l'appli |
| `output/cover.png` | Image de couverture (1080 × 1920) |
| `index.html` | Lecteur interactif (lecture, chapitres, image par image) |

## Storyboard

| Temps | Chapitre | Texte à l'écran | Ce qu'on voit |
| --- | --- | --- | --- |
| 0:00 – 0:03 | Accroche | « La pyramide de **Ponzi** » · *expliquée en 1 minute* | Une pyramide de blocs se construit ; des billets montent vers le sommet ; la caméra plonge dans le bloc du sommet. |
| 0:03 – 0:09 | 01 · La promesse | « Tout commence par une promesse… » | L'organisateur (haut-de-forme, lunettes noires) : « Confie-moi 100 €… je te rends **150 €** dans 45 jours ! » · tampon **+50 % GARANTI**. Note : c'était la vraie promesse de Charles Ponzi (Boston, 1920). |
| 0:09 – 0:15 | 01 · La promesse | « 3 personnes lui confient 100 € » · « Mais en secret… il n'investit **rien**. » | 3 investisseurs envoient leurs billets dans la caisse (compteur 0 → 300 €). « Entreprise » et « Placement » sont barrés. |
| 0:15 – 0:23 | 02 · Le secret | « 45 jours plus tard, il doit les payer. » · « Il paie les **anciens** avec l'argent des **nouveaux**. » | 9 nouveaux versent 900 € ; la caisse verse 150 € à chacun des 3 premiers (+150 €, visages heureux) ; flux d'argent en boucle. |
| 0:23 – 0:29 | 03 · L'illusion | « Les anciens sont payés… alors ils en parlent. » · « Et de plus en plus de monde entre… » | Bulles « Ça marche ! », ondes de bouche-à-oreille, dézoom : 27 nouveaux, les 9 précédents sont payés. |
| 0:29 – 0:36 | 04 · Le piège | « Il en faut toujours **PLUS**. » · « Chaque niveau doit être 3× plus grand ! » · « Au niveau 21, il faudrait plus d'humains que sur Terre ! » | Zoom arrière exponentiel : 27 → 2 187 → 14,3 millions → 10,5 milliards. Barres Terre (8,2 milliards) vs niveau 21 (10,5 milliards), tampon **IMPOSSIBLE**. |
| 0:36 – 0:42 | 05 · L'effondrement | « Un jour, les nouveaux n'arrivent plus… » · « La caisse se vide… » · « …et il disparaît. » · « **Tout s'effondre.** » | Silhouettes vides « ? », la caisse tombe à 0 € (rouge), l'organisateur s'enfuit avec le sac, la pyramide s'écroule (flash rouge, secousse). |
| 0:42 – 0:48 | 06 · Le bilan | « Qui gagne ? Qui perd ? » · « Ici, **2 personnes sur 3** perdent tout. » | Pyramide en 3 bandes : organisateur (magot), premiers (gagnent un peu… au début), derniers (perdent tout = 2/3 de la surface). |
| 0:48 – 0:55 | 07 · Les signaux d'alerte | « Comment la repérer ? » | 4 cartes drapeau rouge : gains élevés « garantis » · « aucun risque » promis · activité floue, invérifiable · retraits bloqués ou retardés. |
| 0:55 – 1:00 | Conclusion | « Si c'est trop beau pour être vrai… …c'est sûrement une **arnaque**. » | Appel à l'action : « Partage pour protéger tes proches ». Fondu final pour une boucle propre. |

Le « 2 sur 3 » découle du modèle montré à l'écran (chaque niveau est 3× plus grand que le précédent : le dernier niveau représente toujours environ 2/3 des participants). La population mondiale (≈ 8,2 milliards) correspond aux estimations de l'ONU.

## Direction artistique

- **Palette** fond bleu nuit (`#141842 → #070918`) avec un code couleur constant :
  jaune `#FFD23F` = l'organisateur · vert `#2EE59D` = l'argent · bleu `#5B8CFF` = les premiers · violet `#A78BFA` = les nouveaux · orange `#FF9F43` = la vague suivante · rouge `#FF4D5E` = le danger.
- **Typographie** Inter Display (Black/ExtraBold) pour les titres, Inter pour les textes secondaires (licence OFL, sous-ensemble WOFF2 embarqué dans `fonts/`).
- **Animations** : mots qui montent un par un, surligneurs qui balaient, rebonds (`outBack`), billets en arc avec traînée et rotation 3D, compteur de caisse animé, caméra qui respire et dézoome, secousses sur les impacts, transitions en cercle, en poussée et en bande diagonale.
- **Zones de sécurité** : textes entre y ≈ 220 et 1 550 px, rien d'important à droite de x ≈ 960 px ni dans le bas de l'écran (interface TikTok/Reels/Shorts).
- **Son** : entièrement synthétisé par `scripts/soundtrack.cjs` (aucun droit à gérer) ; chaque bruitage est calé sur la timeline de l'animation.

## Utilisation

Prérequis : Node.js ≥ 18 et `ffmpeg` dans le `PATH`.

```bash
npm install          # installe Playwright (Chromium headless pour le rendu)
npm run preview      # puis ouvrir http://localhost:8080 → lecteur interactif
npm run build        # bande-son + rendu complet → output/pyramide-de-ponzi*.mp4
npm run render:30fps # variante 30 i/s si une plateforme l'exige
npm run stills       # captures PNG de contrôle dans output/stills/
```

Options du moteur de rendu : `node scripts/render.cjs --fps 30 --from 10 --to 20 --workers 4 --crf 18 --out fichier.mp4`.

### Modifier l'animation

Tout est dans `src/animation.js` :

- `T` — le conducteur (instants clés de chaque scène) ;
- `CAPTIONS` — les textes à l'écran (`{b:mot}` = mot coloré, `[r:mot]` = surligneur ; couleurs `y g r b v o w`) ;
- `CHAPTERS` — les pastilles de chapitre ;
- `CUES` — les repères sonores, recalculés depuis la timeline (relancer `npm run soundtrack` après un changement de timing).

Le rendu est une fonction pure du temps (`render(ctx, t)`) : l'aperçu, la vidéo et la bande-son restent toujours synchronisés.

## Publication

- Format : MP4 H.264 High 4.2, 1080 × 1920, 60 i/s, yuv420p, AAC 192 kb/s 48 kHz, `faststart`.
- Accepté tel quel par TikTok, Instagram Reels et YouTube Shorts (≤ 60 s).
- Légende suggérée : *« La pyramide de Ponzi expliquée en 1 minute 💸 Si c'est trop beau pour être vrai… #finance #arnaque #ponzi #argent #education »*.
