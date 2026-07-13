// LevelSelectScene: the "pick a battleground" screen between Title and GameScene. Ported from
// the stage/level-select.html mockup - a vertical list of level cards (thumbnail + title + tag
// + one-line pitch), tap to select, Play to commit. River and Shoreline (internal key: 'ocean')
// are real, playable levels; Forest and Volcano are shown locked ("Coming soon") so the roadmap
// reads honestly without looking unfinished. Reached from TitleScene's Start button and
// GameScene's New Game flows.

import { sfx } from '../lib/sfx.js';
import { settings } from '../lib/settings.js';
import { setSceneCrt, addCrtSafeHit } from '../lib/CrtPipeline.js';
import { createTutorialOverlay, createSettingsOverlay, applyDlss } from '../lib/ui.js';

const FONT = 'system-ui, -apple-system, sans-serif';
const HEAD = "'Grenze', Georgia, serif";
const INK = '#e7e9f0';
const SUBTLE = '#aeb4c6';
const MUTED = '#7c8398';
const CARD = 0x22263a;
const CARD_BORDER = 0x333850;
const CARD_BORDER_HOVER = 0x4a5175;

// One entry per level card, in display order. `ready: true` levels are selectable; the rest
// render locked (dimmed thumbnail + lock glyph) and never respond to taps.
const LEVELS = [
  {
    key: 'river', title: 'River', ready: true,
    desc: 'A meandering river splits the board - only two bridges cross it, so every fight funnels through them.',
    // Deep river water edge to edge with faint drifting-light streaks (echoing the in-game
    // "Arcane flow" river), crossed by a miniature of the REAL bridge: a vertical plank deck
    // bowed at its middle (same parabolic lift + sideways skew as GameScene.drawBridges), with
    // the dark underside slab, plank seams, and crest highlight of the full-size crossing.
    draw: (g, x, y, s) => {
      g.fillStyle(0x122c46, 1).fillRoundedRect(x, y, s, s, 10);
      g.fillStyle(0x1a3a5c, 1).fillRoundedRect(x, y + s * 0.30, s, s * 0.40, 6);

      const top = y + s * 0.04, bot = y + s * 0.96, span = bot - top;
      const cx = x + s * 0.5, half = s * 0.17;
      const N = 12, LIFT = 4, ARC = 5, SKEW_END = 3, SKEW_MID = 6;
      const lift = (t) => ARC * 4 * t * (1 - t);
      const skew = (t) => -SKEW_END + (SKEW_MID + SKEW_END) * 4 * t * (1 - t);
      const edge = (xs) => {
        const pts = [];
        for (let k = 0; k <= N; k++) {
          const t = k / N;
          pts.push({ x: xs + skew(t), y: top + span * t - lift(t) });
        }
        return pts;
      };
      const deck = edge(cx - half).concat(edge(cx + half).reverse());
      g.fillStyle(0x53381c, 1).fillPoints(deck.map((p) => ({ x: p.x, y: p.y + LIFT })), true);
      g.fillStyle(0x8a6636, 1).fillPoints(deck, true);
      g.lineStyle(2, 0x5f451f, 1);
      const planks = 7;
      for (let i = 1; i < planks; i++) {
        const t = i / planks, py = top + span * t - lift(t), sx = skew(t);
        g.beginPath(); g.moveTo(cx - half + sx, py); g.lineTo(cx + half + sx, py); g.strokePath();
      }
      const yc = top + span * 0.5 - lift(0.5), xc = skew(0.5);
      g.lineStyle(2, 0x9c7a44, 0.8);
      g.beginPath(); g.moveTo(cx - half + xc, yc); g.lineTo(cx + half + xc, yc); g.strokePath();
    },
    // Two faint light streaks drifting downstream under the bridge deck (the same "Arcane flow"
    // language as GameScene.drawRiverFlow), masked to the thumbnail's rounded rect so the card
    // itself carries the live river mechanic instead of a static painted line.
    animate: (scene, x, y, s) => {
      const maskGfx = scene.make.graphics({}, false);
      maskGfx.fillStyle(0xffffff, 1).fillRoundedRect(x, y, s, s, 10);
      const mask = maskGfx.createGeometryMask();
      const streak = (yFrac, w, h, alpha, duration) => {
        const bar = scene.add.rectangle(x - w, y + s * yFrac, w, h, 0xbfe9f0, alpha).setOrigin(0, 0.5).setMask(mask);
        scene.tweens.add({
          targets: bar, x: { from: x - w, to: x + s }, duration, repeat: -1, ease: 'Linear',
        });
      };
      streak(0.41, s * 0.55, 2, 0.45, 2400);
      streak(0.61, s * 0.54, 2, 0.30, 3300);
    },
  },
  {
    key: 'ocean', title: 'Shoreline', ready: true,
    desc: 'Twin tidal shoals flood and drain each match - tides sweep in, clear ownership, then recede and leave it open to reclaim.',
    // A single live shoal tile, not a static ocean gradient: dry sand with twinkling glitter,
    // then the tide sweeps in as a corner bloom (same "corner bloom + foam crest" treatment as
    // the real GameScene.beginTileBloom/drawTideBloom), holds high, then recedes back to sand
    // from the opposite corner - the actual flood/recede mechanic playing out on one tile.
    draw: (g, x, y, s) => {
      g.fillStyle(0x3d3018, 1).fillRoundedRect(x, y, s, s, 10);
    },
    animate: (scene, x, y, s) => {
      const SAND = 0x3d3018, HIGH = 0x164a5f, WARN = 0x6fefff;
      const maskGfx = scene.make.graphics({}, false);
      maskGfx.fillStyle(0xffffff, 1).fillRoundedRect(x, y, s, s, 10);
      const mask = maskGfx.createGeometryMask();
      const gfx = scene.add.graphics().setMask(mask);

      const dots = Array.from({ length: 10 }, () => ({
        x: x + s * (0.14 + Math.random() * 0.72),
        y: y + s * (0.14 + Math.random() * 0.72),
        r: 0.7 + Math.random() * 1.1,
        period: 1800 + Math.random() * 1400,
        phase: Math.random() * Math.PI * 2,
      }));

      // Cycle timing (compressed vs. the real 5-round clock so it reads at a glance): dry ->
      // warning -> flood in (bloom) -> held high -> recede (bloom) -> back to dry.
      const DRY_MS = 2200, WARN_MS = 500, BLOOM_MS = 500, HIGH_MS = 1300, RECEDE_MS = 500;
      const tWarn = DRY_MS, tFlood = tWarn + WARN_MS, tHigh = tFlood + BLOOM_MS,
        tRecede = tHigh + HIGH_MS, tEnd = tRecede + RECEDE_MS;
      const near = { x, y: y + s }; // flood grows from bottom-left
      const far = { x: x + s, y }; // recede grows from top-right
      const maxR = s * 1.5;

      scene.animators.push(() => {
        const now = scene.time.now;
        const t = now % tEnd;
        gfx.clear();
        if (t < tWarn) {
          gfx.fillStyle(SAND, 1).fillRoundedRect(x, y, s, s, 10);
          for (const d of dots) {
            const sn = (Math.sin((now / d.period) * Math.PI * 2 + d.phase) + 1) / 2;
            const a = 0.5 * sn;
            if (a > 0.02) gfx.fillStyle(0xffffff, a).fillCircle(d.x, d.y, d.r);
          }
        } else if (t < tFlood) {
          gfx.fillStyle(SAND, 1).fillRoundedRect(x, y, s, s, 10);
          const pulse = 0.35 + 0.45 * ((Math.sin((t - tWarn) / 80) + 1) / 2);
          gfx.lineStyle(3, WARN, pulse).strokeRoundedRect(x + 2, y + 2, s - 4, s - 4, 8);
        } else if (t < tHigh) {
          const p = (t - tFlood) / BLOOM_MS;
          gfx.fillStyle(SAND, 1).fillRoundedRect(x, y, s, s, 10);
          gfx.fillStyle(HIGH, 1).fillCircle(near.x, near.y, p * maxR);
          gfx.lineStyle(3, WARN, 0.85 * (1 - p * 0.6)).strokeCircle(near.x, near.y, p * maxR);
        } else if (t < tRecede) {
          gfx.fillStyle(HIGH, 1).fillRoundedRect(x, y, s, s, 10);
        } else {
          const p = (t - tRecede) / RECEDE_MS;
          gfx.fillStyle(HIGH, 1).fillRoundedRect(x, y, s, s, 10);
          gfx.fillStyle(SAND, 1).fillCircle(far.x, far.y, p * maxR);
          gfx.lineStyle(3, WARN, 0.85 * (1 - p * 0.6)).strokeCircle(far.x, far.y, p * maxR);
        }
      });
    },
  },
  {
    key: 'forest', title: 'Forest', ready: false,
    desc: 'Fog blankets unscouted ground - enemy tiles stay hidden until you scout close enough to see them.',
    draw: (g, x, y, s) => {
      g.fillStyle(0x10130f, 1).fillRoundedRect(x, y, s, s, 10);
      g.fillStyle(0x1e3a24, 1).fillCircle(x + s * 0.3, y + s * 0.35, s * 0.22);
      g.fillStyle(0x244528, 1).fillCircle(x + s * 0.68, y + s * 0.55, s * 0.20);
    },
  },
  {
    key: 'volcano', title: 'Volcano', ready: false,
    desc: 'A volcano erupts on its own real-time clock, hurling meteors that scorch tiles and clear ownership.',
    // A broad, jagged eruption silhouette (not one skinny peak) with lava streaks down both
    // slopes and an oversized, bright crater core, so it reads as "erupting" at a glance.
    draw: (g, x, y, s) => {
      g.fillStyle(0x170a09, 1).fillRoundedRect(x, y, s, s, 10);
      g.fillStyle(0x241412, 1).fillTriangle(x + s * 0.06, y + s, x + s * 0.94, y + s, x + s * 0.5, y + s * 0.30);
      g.fillStyle(0x2c1815, 1);
      g.fillTriangle(x + s * 0.06, y + s, x + s * 0.40, y + s * 0.55, x + s * 0.5, y + s * 0.30);
      g.fillTriangle(x + s * 0.94, y + s, x + s * 0.62, y + s * 0.58, x + s * 0.5, y + s * 0.30);
      g.fillStyle(0xd23b3b, 0.85);
      g.fillTriangle(x + s * 0.47, y + s * 0.34, x + s * 0.40, y + s * 0.80, x + s * 0.50, y + s * 0.80);
      g.fillTriangle(x + s * 0.53, y + s * 0.34, x + s * 0.60, y + s * 0.72, x + s * 0.52, y + s * 0.72);
      g.fillStyle(0xff9a3d, 1).fillCircle(x + s * 0.5, y + s * 0.32, s * 0.11);
      g.fillStyle(0xffe27a, 1).fillCircle(x + s * 0.5, y + s * 0.32, s * 0.055);
    },
    // Pulsing crater glow + a few rising, fading embers for an actively-erupting feel.
    animate: (scene, x, y, s) => {
      const maskGfx = scene.make.graphics({}, false);
      maskGfx.fillStyle(0xffffff, 1).fillRoundedRect(x, y, s, s, 10);
      const mask = maskGfx.createGeometryMask();
      const cx = x + s * 0.5, cy = y + s * 0.32;
      const glow = scene.add.circle(cx, cy, s * 0.14, 0xff6a3d, 0.35)
        .setBlendMode(Phaser.BlendModes.ADD).setMask(mask);
      scene.tweens.add({
        targets: glow, scale: { from: 0.85, to: 1.25 }, alpha: { from: 0.45, to: 0.15 },
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const emberAt = (ex, delay) => {
        const ember = scene.add.circle(ex, y + s * 0.30, s * 0.02, 0xffb85c, 0.9).setMask(mask);
        scene.tweens.add({
          targets: ember, y: { from: y + s * 0.30, to: y + s * 0.02 }, alpha: { from: 0.9, to: 0 },
          duration: 1300, delay, repeat: -1, ease: 'Sine.easeOut',
        });
      };
      emberAt(cx - s * 0.05, 0);
      emberAt(cx + s * 0.06, 400);
      emberAt(cx, 800);
    },
  },
];

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    setSceneCrt(this, settings.crt);
    applyDlss(this);
    this.sfx = sfx;
    // Per-frame thumbnail animation callbacks (river streaks, ocean tide cycle). A plain array
    // driven by this scene's own update() rather than scene.events.on('update', ...), since this
    // scene object gets reused on every return trip from Title/GameScene ("start" re-runs create()
    // without destroying the instance) - registering event listeners here would stack a fresh one
    // on every visit. Resetting the array on each create() avoids that leak entirely.
    this.animators = [];

    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const cx = W / 2;

    this.tutorial = createTutorialOverlay(this);
    this.settingsPanel = createSettingsOverlay(this, { onHowToPlay: () => this.tutorial.show() });

    this.add.text(cx, Math.round(H * 0.08), 'Choose Your Foothold', {
      fontFamily: HEAD, fontSize: '40px', fontStyle: 'bold', color: INK,
    }).setOrigin(0.5);
    this.add.text(cx, Math.round(H * 0.08) + 40, 'Pick a battleground', {
      fontFamily: FONT, fontSize: '18px', color: MUTED,
    }).setOrigin(0.5);

    // Back arrow to Title, top-left - matches the settings gear's card treatment for a
    // consistent "small square control" language across screens.
    const backW = 60, backH = 60, backX = 20, backY = 26;
    this.add.graphics().fillStyle(0x2a2e40, 1).fillRoundedRect(backX, backY, backW, backH, 12);
    this.add.text(backX + backW / 2, backY + backH / 2, '←', { fontFamily: FONT, fontSize: '30px', color: INK }).setOrigin(0.5);
    // Re-centered on where the CRT barrel-warp (see CrtPipeline) actually displays this corner,
    // not where it's logically drawn - padding alone can't fix a directional shift.
    addCrtSafeHit(this, backX + backW / 2, backY + backH / 2, backW, backH, 12)
      .on('pointerdown', () => { this.sfx.play('newgame'); this.scene.start('TitleScene'); });

    // Settings gear, top-right - same treatment as Title/GameScene so it reads as one control.
    const gW = 60, gH = 60, gxL = W - 20 - gW, gyT = 26;
    const gcx = gxL + gW / 2, gcy = gyT + gH / 2;
    this.add.graphics().fillStyle(0x2a2e40, 1).fillRoundedRect(gxL, gyT, gW, gH, 12);
    this.add.text(gcx, gcy, '⚙️', { fontFamily: FONT, fontSize: '26px' }).setOrigin(0.5);
    addCrtSafeHit(this, gcx, gcy, gW, gH, 12).on('pointerdown', () => this.settingsPanel.show());

    // --- Level card list ---
    const listW = Math.min(620, W * 0.94);
    const listX = cx - listW / 2;
    const rowH = 138, rowGap = 16;
    const listTop = Math.round(H * 0.20);

    LEVELS.forEach((lvl, i) => {
      const y = listTop + i * (rowH + rowGap);
      this.buildCard(lvl, listX, y, listW, rowH);
    });

    this.applyCrt();
  }

  applyCrt() {
    setSceneCrt(this, settings.crt);
    applyDlss(this);
  }

  update() {
    this.animators.forEach((fn) => fn());
  }

  // One selectable/locked row: thumbnail swatch + title/tag + description. Locked rows render
  // dimmed with a lock glyph and never wire a pointerdown handler.
  buildCard(lvl, x, y, w, h) {
    const border = this.add.graphics();
    const drawBorder = (color, alpha = 1) => {
      border.clear();
      border.lineStyle(2, color, alpha).strokeRoundedRect(x, y, w, h, 12);
    };
    this.add.graphics().fillStyle(CARD, lvl.ready ? 1 : 0.72).fillRoundedRect(x, y, w, h, 12);
    drawBorder(CARD_BORDER);

    const thumb = 96, pad = 14;
    const tg = this.add.graphics();
    lvl.draw(tg, x + pad, y + pad, thumb);
    if (lvl.animate) lvl.animate(this, x + pad, y + pad, thumb);
    if (!lvl.ready) {
      tg.fillStyle(0x0a0b12, 0.35).fillRoundedRect(x + pad, y + pad, thumb, thumb, 10);
      this.add.text(x + pad + thumb / 2, y + pad + thumb / 2, '🔒', { fontFamily: FONT, fontSize: '26px' }).setOrigin(0.5);
    }

    const bodyX = x + pad + thumb + 16;
    const bodyW = w - (pad + thumb + 16) - pad;
    this.add.text(bodyX, y + 18, lvl.title, {
      fontFamily: HEAD, fontSize: '28px', fontStyle: 'bold', color: lvl.ready ? INK : SUBTLE,
    }).setOrigin(0, 0);
    // Playable levels carry no tag (the card being lit and tappable says it all); locked ones
    // get a "Coming soon" pill - a real rounded-rect pill (text backgroundColor can't round its
    // corners), sized from the rendered text so it hugs the label at any font.
    if (!lvl.ready) {
      const tagText = this.add.text(0, y + 24, 'Coming soon', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#c9cfe2',
      }).setOrigin(0, 0.5);
      const tx = bodyX + this.measureTextWidth(lvl.title, 28) + 14;
      const pw = tagText.width + 24, ph = tagText.height + 10;
      this.add.graphics().fillStyle(0x2a2e40, 1).fillRoundedRect(tx, y + 24 - ph / 2, pw, ph, ph / 2);
      tagText.setPosition(tx + 12, y + 24);
      this.children.bringToTop(tagText);
    }
    this.add.text(bodyX, y + 58, lvl.desc, {
      fontFamily: FONT, fontSize: '16px', color: SUBTLE, wordWrap: { width: bodyW }, lineSpacing: 3,
    }).setOrigin(0, 0);

    if (lvl.ready) {
      const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => drawBorder(CARD_BORDER_HOVER));
      hit.on('pointerout', () => drawBorder(CARD_BORDER));
      hit.on('pointerdown', () => {
        this.sfx.play('newgame');
        this.scene.start('GameScene', { level: lvl.key });
      });
    }
    return { lvl, drawBorder };
  }

  // Rough text-width estimate (no live measurement needed pre-render) so the tag pill sits
  // right after the title without a second layout pass.
  measureTextWidth(str, fontSize) {
    return str.length * fontSize * 0.56;
  }

}
