#!/usr/bin/env python3
# VIGNETTES DES DÉCORATIONS (phase 7) : items/thumb/Item-N.webp, 96 × 96 px, recadrées sur le
# dessin (sans le vide transparent autour), pour la rangée « Decorations » de la palette.
# Tirées des originaux sans perte (items/source/*.png), comme make-webp.py ; à relancer dès
# qu'une décoration change ou s'ajoute. Usage (à la racine) : python3 tools/make-decor-thumbs.py
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT, SIZE, PAD = ROOT / 'items' / 'source', ROOT / 'items' / 'thumb', 96, 0.08
OUT.mkdir(exist_ok=True)
for png in sorted(SRC.glob('*.png')):
    im = Image.open(png).convert('RGBA')
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox() or (0, 0, *im.size)
    crop = im.crop(box)
    side = max(crop.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    inner = round(SIZE * (1 - 2 * PAD))
    thumb = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    small = canvas.resize((inner, inner), Image.LANCZOS)
    thumb.paste(small, ((SIZE - inner) // 2, (SIZE - inner) // 2), small)
    thumb.save(OUT / (png.stem + '.webp'), 'WEBP', quality=90, method=6)
    print(f'{png.name} : dessin {crop.width} × {crop.height} px -> items/thumb/{png.stem}.webp')
