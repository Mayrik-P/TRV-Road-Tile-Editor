# COPIES WEBP DES IMAGES DU PLATEAU (tranche 1a, docs/roadmap.md).
#
# Les originaux sans perte (PNG à 300 dpi) sont rangés dans <dossier>/source/ : ils
# restent dans le dépôt mais la page ne les charge jamais. Ce script en tire la copie
# chargée par l'appli, <dossier>/<nom>.webp, avec les réglages validés par le test à
# l'aveugle de Mayrik du 19/11 (5/20 : aucune différence perçue à taille réelle) :
# WebP qualité 95, compression la plus poussée (method 6), transparence sans perte.
# Encodeur : libwebp (la bibliothèque officielle de Google), via Pillow.
#
# À relancer dès qu'une image de source/ change ou s'ajoute.
#   python3 tools/make-webp.py              -> textures, sprites, items, edges
#   python3 tools/make-webp.py sprites      -> un seul dossier
# Pré-requis (une fois) : python3 -m pip install Pillow
import os, sys, glob
from PIL import Image

FOLDERS = ['textures', 'sprites', 'items', 'edges']
QUALITY, METHOD = 95, 6

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
folders = sys.argv[1:] or FOLDERS
total_src = total_out = 0
for d in folders:
    files = sorted(glob.glob(os.path.join(root, d, 'source', '*.png')))
    if not files:
        print(f'{d} : aucun PNG dans {d}/source/'); continue
    for f in files:
        out = os.path.join(root, d, os.path.basename(f)[:-4] + '.webp')
        Image.open(f).save(out, 'WEBP', quality=QUALITY, method=METHOD, alpha_quality=100)
        total_src += os.path.getsize(f); total_out += os.path.getsize(out)
    print(f'{d} : {len(files)} images')
print(f'Total : {total_src / 1e6:.1f} Mo de PNG -> {total_out / 1e6:.2f} Mo de WebP')
