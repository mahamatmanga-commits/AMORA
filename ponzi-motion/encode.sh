#!/usr/bin/env bash
# Encode les images PNG produites par render.cjs.
#   ./encode.sh <dossier_images> <theme: dark|light|alpha> <dossier_sortie>
# dark/light -> MP4 H.264 (film complet + une vidéo par scène)
# alpha      -> MOV ProRes 4444 avec transparence (film complet)
set -euo pipefail
FRAMES="$1"; THEME="$2"; OUT="$3"
FPS=60
mkdir -p "$OUT/scenes_$THEME"

# début/fin de chaque scène en secondes (identique à SCENES dans src/ponzi.js)
SCENES=(
  "01_organisateur 0.0 3.6"
  "02_premiers-investisseurs 3.6 8.4"
  "03_les-nouveaux-paient-les-anciens 8.4 16.8"
  "04_la-pyramide-grandit 16.8 26.0"
  "05_plus-personne-n-arrive 26.0 31.0"
  "06_effondrement 31.0 38.0"
)

H264=(-c:v libx264 -preset slow -crf 15 -tune animation -pix_fmt yuv420p -profile:v high
      -vf "scale=out_color_matrix=bt709:out_range=tv"
      -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
      -movflags +faststart -an)

if [[ "$THEME" == "alpha" ]]; then
  ffmpeg -hide_banner -loglevel error -y -framerate $FPS -i "$FRAMES/f%05d.png" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0 -qscale:v 11 -an \
    "$OUT/ponzi_complet_transparent.mov"
  exit 0
fi

ffmpeg -hide_banner -loglevel error -y -framerate $FPS -i "$FRAMES/f%05d.png" "${H264[@]}" \
  "$OUT/ponzi_complet_$THEME.mp4"

for s in "${SCENES[@]}"; do
  read -r name a b <<<"$s"
  start=$(python3 -c "print(round($a*$FPS))")
  # la dernière scène inclut l'image finale
  count=$(python3 -c "print(round($b*$FPS) - round($a*$FPS) + (1 if $b >= 38 else 0))")
  ffmpeg -hide_banner -loglevel error -y -framerate $FPS -start_number "$start" -i "$FRAMES/f%05d.png" \
    -frames:v "$count" "${H264[@]}" "$OUT/scenes_$THEME/${name}_$THEME.mp4"
done
