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
# Exception (Mayrik, 19/11) : les 6 textures de terrain sources (4243 × 2718 px, ~80 Mo
# en PNG) ne sont PAS gardées dans le dépôt ; Mayrik les a dans ses dossiers de travail.
# Pour en refaire les WebP : les redéposer dans textures/source/ (mêmes noms), lancer
# ce script, puis les retirer à nouveau.
#   python3 tools/make-webp.py              -> textures, sprites, items, edges
#   python3 tools/make-webp.py sprites      -> un seul dossier
# Pré-requis (une fois) : python3 -m pip install Pillow
import os, sys, glob
from PIL import Image

FOLDERS = ['textures', 'sprites', 'items', 'edges']
QUALITY, METHOD = 95, 6
# Aperçus pour l'écran (tranche 1c) : copies réduites, mêmes noms, un sous-dossier
# par définition (méthode des dossiers par densité d'Android, reprise de TRV-Pocket :
# tools/image-variants/make-variants.js). La page prend la plus petite qui reste
# nette pour la taille réellement affichée ; l'export utilise toujours l'original.
# Toujours tirées des PNG d'origine (jamais deux compressions à la suite).
VARIANTS = [('half', 0.5), ('quarter', 0.25)]
VARIANT_QUALITY = 92

def save_webp(im, path, quality):
    im.save(path, 'WEBP', quality=quality, method=METHOD, alpha_quality=100)
    return os.path.getsize(path)

def reduce(im, scale):
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    if im.mode == 'RGBA':
        # Redimensionnement en alpha prémultiplié (mode 'RGBa' de Pillow) : évite les
        # liserés sombres au bord des zones transparentes.
        return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    return im.resize(size, Image.LANCZOS)

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
folders = sys.argv[1:] or FOLDERS
total_src = total_out = 0
total_var = {name: 0 for name, _ in VARIANTS}
for d in folders:
    files = sorted(glob.glob(os.path.join(root, d, 'source', '*.png')))
    if not files:
        print(f'{d} : aucun PNG dans {d}/source/'); continue
    for name, _ in VARIANTS:
        os.makedirs(os.path.join(root, d, name), exist_ok=True)
    for f in files:
        base = os.path.basename(f)[:-4] + '.webp'
        im = Image.open(f)
        total_src += os.path.getsize(f)
        total_out += save_webp(im, os.path.join(root, d, base), QUALITY)
        for name, scale in VARIANTS:
            total_var[name] += save_webp(reduce(im, scale), os.path.join(root, d, name, base), VARIANT_QUALITY)
    print(f'{d} : {len(files)} images')
print(f'Total : {total_src / 1e6:.1f} Mo de PNG -> {total_out / 1e6:.2f} Mo de WebP (originaux)')
for name, _ in VARIANTS:
    print(f'  aperçus {name} : {total_var[name] / 1e6:.2f} Mo')
