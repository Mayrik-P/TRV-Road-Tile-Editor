# Contributing to TRV Road Tile Editor

Thank you for wanting to help! This is a small community project with a single maintainer,
**Mayrik PADEY**, who decides its direction and what gets merged. These rules keep the project
coherent and keep reviews manageable.

This is a small hobby project, maintained in spare time: replies may take a while, and ideas are reviewed from time to time against the [roadmap](ROADMAP.md).
For questions and informal chat, use the game's Discord channel
(https://discord.com/channels/722465956265197618/1275818318921465927) rather than GitHub issues.

## 1. Discuss first, code second

**Open an issue before writing any code.** Describe the problem or the idea, and wait until the
maintainer agrees that it fits the project ([ROADMAP.md](ROADMAP.md)). Only then start working on it.

A pull request that does not answer an accepted issue may be closed without review. This is not
personal: it is the only way to keep the project from going in every direction at once.

- **Bug reports** are always welcome: use the *Bug report* template.
- **Ideas** are welcome too: use the *Idea* template. A "no" or "not now" is possible.

## 2. Pull requests

- **One topic per pull request, kept small.** Large or mixed pull requests will be asked to be split.
- **Link the accepted issue** in the description.
- **Do not reformat or rewrite code** that your change does not need.
- The maintainer may edit, postpone or decline any contribution, and decides alone what is merged
  into `main` and published.

## 3. Test in a real browser

Before opening a pull request, check your change **on a computer and on a phone** (or the phone mode
of your browser's developer tools). The repository has automated checks driving a real Chromium
browser, in `tools/check-*.js` (Node.js and Playwright):

```bash
python3 -m http.server 8765
```

```bash
node tools/check-app.js http://localhost:8765/ /tmp/out
```

Run the checks related to what you changed and report the results in the pull request.
If you change a CSS or JS file, run `python3 tools/stamp-assets.py` before committing.

## 4. AI-assisted contributions ("vibe coding")

This project is itself written with an AI coding assistant, so AI-written code is welcome, including
"vibe coded" contributions. What matters is the result:

- **Tested before submitting, on a phone AND on a computer.** Untested pull requests will be closed.
- **Only working and technically sound code is accepted**: no regressions, no needless complexity, no
  slower loading, no dead code.
- **Say so** in the pull request when an AI tool wrote the code.
- The usual rules apply: accepted issue first, one small topic.

## 5. Conventions

- Texts shown in the app, file names and code identifiers are in **English**.
- Code comments are in **English**.
- The app is plain HTML, CSS and JavaScript with no build step and no dependencies to install for
  users; keep it that way.
- Every third-party resource (image, sound, font, library) must have a license allowing its use in a
  free non-commercial project, and must be added to the Credits list (`js/credits.js`).

## 6. Licensing of contributions

By submitting a contribution, you agree that it is licensed under the same terms as the part of the
project it belongs to: code under the [PolyForm Noncommercial License 1.0.0](LICENSES/PolyForm-Noncommercial-1.0.0.md),
artwork and documentation under [CC BY-NC-SA 4.0](LICENSES/CC-BY-NC-SA-4.0.txt) (see [LICENSE](LICENSE)).
Do not submit material you do not have the right to share, and never submit Restoration Games
artwork without their permission. Extracting the games' artwork from this project to use or distribute it
elsewhere is not allowed.

## 7. Code of conduct

Be kind and constructive. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
