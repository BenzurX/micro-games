# Asset Credits

Every third-party asset used in Foothold is listed here: name, author, source, license.
Verify commercial use is permitted before importing (see project CLAUDE.md → Asset Licensing Rule).

## Icons

- **Board Game Icons** — Kenney (Kenney Vleugels) — https://kenney.nl/assets/board-game-icons — License: CC0 1.0 (public domain, commercial use OK, no attribution required).
  - Used (recolored/tinted per resource): `d2` → gold, `resource_lumber` → wood, `resource_wood` → stone (brick-like log tinted grey; pack has no stone icon), `award` → special node, `structure_watchtower` → home-base tile AND title-screen hero art (tinted gold; game-ready copy at `assets/watchtower.png`), `card_lift` → upgrade marker.
  - Raw pack lives in `images/Vector/` (SVG) and `images/PNG/` (raster, 64px & 128px); game-ready copies (with injected viewBox/size) in `assets/icons/`.

## Fonts

- **Grenze** — Omnibus-Type (Ana Sanfelippo, Pablo Cosgaya) — https://fonts.google.com/specimen/Grenze — License: SIL Open Font License 1.1 (commercial use OK, embedding/bundling permitted; reserved-name rule only restricts selling the font itself).
  - Used as the display serif for titles, modal headings, and buttons only (body text stays system-ui). Weights 400 + 700, vendored as woff2 under `assets/fonts/` (`grenze-400.woff2`, `grenze-700.woff2`) so the game runs offline and in the mobile build.

## Design references (not shipped in the build)

- `images/reference/crt1–3.png` — CRT-look reference screenshots gathered while designing the
  CRT filter. Reference material only, not bundled into the game. Provenance/license unverified —
  keep out of any shipped/store build (see note in PROGRESS.md).
