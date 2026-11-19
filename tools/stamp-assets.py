#!/usr/bin/env python3
# EMPREINTES DES FICHIERS CSS / JS DANS index.html (contre les copies périmées en cache).
#
# Chaque <link href="css/…"> et <script src="js/…"> de index.html reçoit « ?v=<empreinte> »,
# les 10 premiers caractères du SHA-256 du contenu du fichier. Un fichier modifié change
# d'adresse : navigateur, GitHub Pages et raw.githack le rechargent forcément ; les autres
# restent en cache. Méthode des outils de construction (« content hash » de webpack, Vite…),
# appliquée à la main puisque le dépôt est servi tel quel.
#
# Usage (à la racine du dépôt) :
#   python3 tools/stamp-assets.py          met les empreintes à jour (à lancer avant chaque commit)
#   python3 tools/stamp-assets.py --check  code de sortie 1 si une empreinte est périmée ou absente
import hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'
REF = re.compile(r'(?P<attr>(?:href|src))="(?P<path>(?:css|js)/[^"?#]+\.(?:css|js))(?:\?v=(?P<v>[0-9a-f]*))?"')

def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:10]

def main():
    check = '--check' in sys.argv[1:]
    html = INDEX.read_text(encoding='utf-8')
    stale = []
    def stamp(m):
        want = digest(m['path'])
        if m['v'] != want:
            stale.append(m['path'])
        return f'{m["attr"]}="{m["path"]}?v={want}"'
    new = REF.sub(stamp, html)
    if check:
        for p in stale:
            print('empreinte périmée ou absente :', p)
        print('empreintes à jour' if not stale else 'lancer : python3 tools/stamp-assets.py')
        sys.exit(1 if stale else 0)
    if new != html:
        INDEX.write_text(new, encoding='utf-8')
    print(f'{len(REF.findall(html))} fichiers, {len(stale)} empreinte(s) mise(s) à jour' + (' : ' + ', '.join(stale) if stale else ''))

main()
