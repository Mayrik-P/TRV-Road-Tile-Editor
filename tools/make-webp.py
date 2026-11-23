# WEBP COPIES OF THE BOARD IMAGES (slice 1a, docs/roadmap.md).
#
# The lossless originals (300 dpi PNGs) are stored in <folder>/source/: they
# stay in the repo but the page never loads them. This script derives from them the copy
# loaded by the app, <folder>/<name>.webp, with the settings validated by Mayrik's
# blind test of 19/11 (5/20: no difference perceived at actual size):
# WebP quality 95, strongest compression (method 6), lossless transparency.
# Encoder: libwebp (Google's official library), via Pillow.
#
# To be rerun whenever an image in source/ changes or is added.
# Exception (Mayrik, 19/11): the 6 source terrain textures (4243 x 2718 px, ~80 MB
# as PNG) are NOT kept in the repo; Mayrik has them in his working folders.
# To rebuild their WebPs: put them back in textures/source/ (same names), run
# this script, then remove them again.
#   python3 tools/make-webp.py              -> textures, sprites, items, edges
#   python3 tools/make-webp.py sprites      -> a single folder
# Prerequisite (once): python3 -m pip install Pillow
import os, sys, glob
from PIL import Image

FOLDERS = ['textures', 'sprites', 'items', 'edges']
QUALITY, METHOD = 95, 6
# Screen previews (slice 1c): reduced copies, same names, one subfolder
# per definition (Android's density-folder method, taken from TRV-Pocket:
# tools/image-variants/make-variants.js). The page takes the smallest one that stays
# sharp for the size actually displayed; the export always uses the original.
# Always derived from the original PNGs (never two compressions in a row).
VARIANTS = [('half', 0.5), ('quarter', 0.25)]
VARIANT_QUALITY = 92

def save_webp(im, path, quality):
    im.save(path, 'WEBP', quality=quality, method=METHOD, alpha_quality=100)
    return os.path.getsize(path)

def reduce(im, scale):
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    if im.mode == 'RGBA':
        # Resizing in premultiplied alpha (Pillow 'RGBa' mode): avoids dark
        # fringes at the edge of transparent areas.
        return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    return im.resize(size, Image.LANCZOS)

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
folders = sys.argv[1:] or FOLDERS
total_src = total_out = 0
total_var = {name: 0 for name, _ in VARIANTS}
for d in folders:
    files = sorted(glob.glob(os.path.join(root, d, 'source', '*.png')))
    if not files:
        print(f'{d}: no PNG in {d}/source/'); continue
    for name, _ in VARIANTS:
        os.makedirs(os.path.join(root, d, name), exist_ok=True)
    for f in files:
        base = os.path.basename(f)[:-4] + '.webp'
        im = Image.open(f)
        total_src += os.path.getsize(f)
        total_out += save_webp(im, os.path.join(root, d, base), QUALITY)
        for name, scale in VARIANTS:
            total_var[name] += save_webp(reduce(im, scale), os.path.join(root, d, name, base), VARIANT_QUALITY)
    print(f'{d}: {len(files)} images')
print(f'Total: {total_src / 1e6:.1f} MB of PNG -> {total_out / 1e6:.2f} MB of WebP (originals)')
for name, _ in VARIANTS:
    print(f'  previews {name}: {total_var[name] / 1e6:.2f} MB')
