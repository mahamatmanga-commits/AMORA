# Pyramide de Ponzi — motion design vertical

Animation 2D sans texte, sans son et sans voix, pensée comme support visuel
d'une explication face caméra (TikTok, Reels, Shorts).

- Format : 1080 × 1920 (9:16), 60 images/s, 38 s
- Aucun texte, aucun chiffre, aucun symbole monétaire : tout passe par les formes, les couleurs et le mouvement
- Deux fonds sobres : sombre (bleu nuit) et clair (crème)

## Fichiers livrés (`export/`)

| Fichier | Usage |
|---|---|
| `ponzi_complet_dark.mp4` | film complet, fond bleu nuit |
| `ponzi_complet_light.mp4` | film complet, fond clair |
| `scenes_dark/`, `scenes_light/` | une vidéo par scène, pour caler chaque passage sur ta voix |

## Déroulé

| # | Temps | Ce qu'on voit | Ce que tu peux dire dessus |
|---|---|---|---|
| 1 | 0,0 – 3,6 s | Onde dorée, l'organisateur (chapeau haut-de-forme) apparaît en haut sur son socle, un petit sac d'argent vide surgit à côté de lui. | « Tout commence avec une personne… » |
| 2 | 3,6 – 8,4 s | Deux premiers investisseurs arrivent. Flèches en pointillé vers le sac, puis trois billets chacun : le sac grossit. | « …qui promet de gros rendements. Les premiers lui confient leur argent. » |
| 3 | 8,4 – 16,8 s | Quatre nouveaux arrivent dessous. Un billet d'un nouveau monte dans le sac, un billet en ressort et descend vers un ancien, qui devient vert (payé, souriant). Les deux premiers trajets sont fléchés. | « L'argent des nouveaux sert à payer les anciens. » |
| 4 | 16,8 – 26,0 s | Trois nouveaux étages se remplissent de plus en plus vite, la caméra recule, les billets fusent, le sac enfle, des chevrons verts montent le long de la pyramide. Les étages du haut sont verts, la base ne touche rien. | « Pour tenir, il faut toujours plus de nouveaux. » |
| 5 | 26,0 – 31,0 s | Des silhouettes en pointillé clignotent sous la base : personne ne vient. Les derniers billets sortent de plus en plus lentement, les chevrons ralentissent, le sac se vide, l'organisateur transpire, les investisseurs virent au gris. | « Le jour où plus personne n'arrive… » |
| 6 | 31,0 – 38,0 s | Tremblement, fissures rouges, les étages cèdent un par un de la base au sommet, le chapeau s'envole, les billets virevoltent et tout finit en tas gris. Plan fixe à la fin. | « …tout s'effondre. » |

Code couleur : **or** = organisateur, **bleu/violet** = nouvel investisseur,
**vert** = argent / investisseur payé, **gris** = investisseur qui a tout perdu, **rouge** = rupture.

## Conseils de montage

- La fin de chaque scène est une pose lisible : si ton explication est plus longue,
  fige la dernière image (« figer l'image » dans CapCut, *Frame Hold* dans Premiere) ou ralentis le clip de la scène.
- Le fond sombre a un léger grain pour éviter les bandes de dégradé après la recompression TikTok/Instagram.
- Zones sûres : l'essentiel reste dans la bande centrale (≈ 380 à 1 560 px de hauteur), à l'écart des boutons et légendes de l'application.
- Une version sans fond (ProRes 4444 avec couche alpha, pour Premiere Pro, Final Cut Pro ou DaVinci Resolve) peut être générée avec le thème `alpha` ; elle n'est pas livrée ici car elle pèse environ 1,8 Go.

## Régénérer / modifier

L'animation est un moteur déterministe en JavaScript (`src/ponzi.js`) :
`PonziAnim.draw(ctx, t, theme)` dessine l'image exacte de l'instant `t`.

```bash
npm install                 # Playwright (Chromium)
open src/index.html         # aperçu en direct, boutons par scène, fond sombre/clair
node render.cjs frames --theme dark --out .frames/dark   # PNG 1080x1920 à 60 i/s
./encode.sh .frames/dark dark export                      # MP4 + une vidéo par scène (ffmpeg)
```

Thèmes : `dark`, `light`, `alpha`. Le minutage de chaque scène, la caméra et les couleurs
sont en tête de `src/ponzi.js` (`SCENES`, `CAM`, `THEMES`, `ROW_T`).
