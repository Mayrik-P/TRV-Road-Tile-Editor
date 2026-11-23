#!/usr/bin/env python3
# FINGERPRINTS OF THE CSS / JS FILES IN index.html (against stale cached copies).
#
# Each <link href="css/..."> and <script src="js/..."> of index.html gets "?v=<fingerprint>",
# the first 10 characters of the SHA-256 of the file content. A modified file changes
# address: browser, GitHub Pages and raw.githack are forced to reload it; the others
# stay cached. Method of build tools (webpack's "content hash", Vite...),
# applied by hand since the repo is served as is.
#
# Usage (at the repo root):
#   python3 tools/stamp-assets.py          updates the fingerprints (run before each commit)
#   python3 tools/stamp-assets.py --check  exit code 1 if a fingerprint is stale or missing
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
            print('stale or missing fingerprint:', p)
        print('fingerprints up to date' if not stale else 'run: python3 tools/stamp-assets.py')
        sys.exit(1 if stale else 0)
    if new != html:
        INDEX.write_text(new, encoding='utf-8')
    print(f'{len(REF.findall(html))} files, {len(stale)} fingerprint(s) updated' + (' : ' + ', '.join(stale) if stale else ''))

main()
