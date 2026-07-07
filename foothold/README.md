# Foothold

A small, turn-based territory-control game: you vs one AI on a procedural portrait board.
Expand onto empty ground, build on resource nodes, upgrade them to double their output, and
siege the enemy - win by capturing their home base or holding the most tiles when the rounds
run out. Game 1 of the Micro Games pipeline.

- **Engine:** Phaser 3 (vendored locally under `vendor/`, no CDN)
- **Stack:** plain ES modules, no build step
- **Target:** mobile-first (Capacitor later), itch.io web build first

## Run it locally

ES modules don't load over `file://`, so serve the folder over HTTP:

```
python -m http.server 8123
```

Then open <http://localhost:8123>.

## Layout

```
src/main.js            Phaser bootstrap (720-wide, device-aspect height, Scale.FIT)
src/scenes/            BootScene (asset load), TitleScene (splash), GameScene (the match)
src/lib/sfx.js         Procedural Web Audio sound engine (synthesized, no audio files)
src/lib/settings.js    Persisted user prefs (sound / volume / CRT) via localStorage
src/lib/ui.js          Shared overlays: How to Play tutorial + Settings panel
src/lib/CrtPipeline.js WebGL CRT post-processing filter (curve, scanlines, grille, bloom, vignette)
assets/icons/          Kenney "Board Game Icons" (CC0), tinted per resource - see assets/CREDITS.md
snapshots/             Frozen, self-contained playable copies of past versions + gallery
vendor/phaser.min.js   Vendored Phaser 3.80.1
```

## Versioning

Flat decimal versions; see [CHANGELOG.md](CHANGELOG.md). Every milestone is frozen as a
self-contained snapshot under `snapshots/` (open `snapshots/index.html` for the timeline).

## Credits & license

Third-party assets are tracked in [assets/CREDITS.md](assets/CREDITS.md) with author, source,
and license (commercial use verified).
