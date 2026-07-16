# Foothold

A small, turn-based territory-control game: you vs one AI on a procedural portrait board.
Expand onto empty ground, build on resource nodes, upgrade them to double their output, and
siege the enemy - win by capturing their home base or holding the most tiles when the rounds
run out (a tile tie is broken by total income; only a full tie is a draw). Game 1 of the
Micro Games pipeline.

- **Engine:** Phaser 3 (vendored locally under `vendor/`, no CDN)
- **Stack:** plain ES modules, no build step
- **Target:** mobile-first (Capacitor later), itch.io web build first
- **PWA:** installable + offline-playable (`manifest.webmanifest` + `sw.js`); see the
  pre-push gate in the root CLAUDE.md for bumping `sw.js`'s `CACHE_VERSION`. When a new
  build finishes installing in the background, a dismissable "Update available" toast
  (`index.html`) lets the player reload on their own terms - it never forces a reload.

## Run it locally

ES modules don't load over `file://`, so serve the folder over HTTP:

```
python -m http.server 8123
```

Then open <http://localhost:8123>.

## Layout

```
src/main.js            Phaser bootstrap (picks a portrait 720-wide or wide 900-tall canvas, Scale.FIT)
src/scenes/            BootScene (asset load), TitleScene (splash), LevelSelectScene (pick a
                        battleground), GameScene (the match)
src/lib/sfx.js         Procedural Web Audio sound engine (synthesized, no audio files)
src/lib/settings.js    Persisted user prefs (sound / volume / CRT / DLSS gag) via localStorage
src/lib/feedback.js    Submits the Settings ▸ Feedback form to the Cloudflare Worker backend
src/lib/ui.js          Shared overlays: How to Play tutorial + Settings panel + Feedback form
src/lib/tileEditor.js  Hidden dev-only tile/tide overlay for the ocean level (D-E-V key or
                        moon-tap to enter); not part of normal play
src/lib/CrtPipeline.js WebGL CRT post-processing filter (curve, scanlines, grille, bloom, vignette)
assets/icons/          Kenney "Board Game Icons" (CC0), tinted per resource - see assets/CREDITS.md
assets/fonts/          Grenze display serif (OFL), vendored woff2 for titles/headings/buttons
snapshots/             Frozen, self-contained playable copies of past versions + gallery
vendor/phaser.min.js   Vendored Phaser 3.80.1
manifest.webmanifest   PWA manifest (name, icons, standalone display)
sw.js                  Service worker: caches the whole game for offline play/install
scripts/                Node-only dev tooling (not shipped in the web build)
  balance-harness.mjs  Headless AI-vs-AI simulator (uses src/lib/rules.js)
worker/                 Cloudflare Worker backend for the in-game Feedback form (separate
                        deploy, not part of the static web build - see worker/README.md)
```

## Versioning

Flat decimal versions; see [CHANGELOG.md](CHANGELOG.md). Every milestone is frozen as a
self-contained snapshot under `snapshots/` (open `snapshots/index.html` for the timeline).

## Credits & license

Third-party assets are tracked in [assets/CREDITS.md](assets/CREDITS.md) with author, source,
and license (commercial use verified).
