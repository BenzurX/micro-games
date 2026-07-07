// TitleScene: the splash / intro screen. Shows the game title, the watchtower hero art, and the
// entry buttons (Start, How to Play), plus a gear that opens the shared Settings panel. It sits
// between BootScene (asset load) and GameScene (the match). Kept deliberately calm and static -
// one strong hero image and clear buttons - so it reads as a polished front door, not a busy menu.

import { sfx } from '../lib/sfx.js';
import { settings, VERSION } from '../lib/settings.js';
import { setSceneCrt } from '../lib/CrtPipeline.js';
import { createTutorialOverlay, createSettingsOverlay } from '../lib/ui.js';

const FONT = 'system-ui, -apple-system, sans-serif';
const INK = '#e7e9f0';
const ACCENT = 0x3d6cff;
const GOLD = 0xf2c14e;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    setSceneCrt(this, settings.crt);

    // Medieval fanfare - on load (if audio is already unlocked, e.g. returning from a game) or on
    // the first tap (which also unlocks the shared mixer), and again whenever the tower is tapped.
    // Web Audio is blocked until a user gesture. Debounced so a single tap that both unlocks the
    // mixer AND lands on the tower doesn't fire two overlapping fanfares.
    let lastFanfare = -Infinity;
    this.fanfare = () => {
      const now = performance.now();
      if (now - lastFanfare < 400) return;
      lastFanfare = now;
      sfx.play('title');
    };
    if (sfx.ctx && sfx.ctx.state === 'running') this.fanfare();
    this.input.once('pointerdown', () => { sfx.unlock(); this.fanfare(); });

    const W = 720;
    const H = this.scale.gameSize.height;
    const cx = W / 2;

    // A reusable soft radial-glow texture (bright center → transparent edge) for the hover halo.
    // Built once via a canvas gradient; a flat filled circle can't fade from the inside out.
    if (!this.textures.exists('radialGlow')) {
      const S = 256, tex = this.textures.createCanvas('radialGlow', S, S);
      const g2d = tex.getContext();
      const grd = g2d.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g2d.fillStyle = grd;
      g2d.fillRect(0, 0, S, S);
      tex.refresh();
    }

    // Shared overlays. Settings' "How to Play" reopens the same tutorial the title uses.
    this.tutorial = createTutorialOverlay(this);
    this.settingsPanel = createSettingsOverlay(this, { onHowToPlay: () => this.tutorial.show() });

    // --- Hero: watchtower art on a soft radial glow, floating gently ---
    const towerY = Math.round(H * 0.26);
    // A soft gold halo behind the tower for depth (a low-alpha filled circle, feathered by scale).
    const glow = this.add.circle(cx, towerY, 260, GOLD, 0.10);
    this.tweens.add({ targets: glow, scale: { from: 0.9, to: 1.06 }, alpha: { from: 0.10, to: 0.16 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // A second, radial halo (bright center → soft edge) that fades in on hover so the tower "lights
    // up" when touched. It breathes on the same slow scale pulse as the base glow; only its alpha
    // is driven by hover, so at rest it's invisible.
    const hoverGlow = this.add.image(cx, towerY, 'radialGlow').setDisplaySize(430, 430).setTint(GOLD).setAlpha(0);
    const hgScale = hoverGlow.scaleX;
    this.tweens.add({ targets: hoverGlow, scaleX: { from: hgScale * 0.9, to: hgScale * 1.06 }, scaleY: { from: hgScale * 0.9, to: hgScale * 1.06 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const tower = this.add.image(cx, towerY, 'watchtower').setDisplaySize(330, 330).setTint(GOLD)
      .setInteractive({ useHandCursor: true });
    const baseScale = tower.scaleX; // scale set by setDisplaySize; hover nudges above this
    // Slow vertical float so the front door feels alive without being noisy.
    this.tweens.add({ targets: tower, y: towerY - 14, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Hover: grow the tower a touch and brighten the halo. Scale-only tweens don't fight the y-float.
    tower.on('pointerover', () => {
      this.tweens.add({ targets: tower, scaleX: baseScale * 1.08, scaleY: baseScale * 1.08, duration: 220, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: hoverGlow, alpha: 0.22, duration: 220, ease: 'Sine.easeOut' });
    });
    tower.on('pointerout', () => {
      this.tweens.add({ targets: tower, scaleX: baseScale, scaleY: baseScale, duration: 260, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: hoverGlow, alpha: 0, duration: 260, ease: 'Sine.easeOut' });
    });
    // Tapping the tower replays the medieval fanfare.
    tower.on('pointerdown', () => { sfx.unlock(); this.fanfare(); });

    // --- Title + tagline ---
    this.add.text(cx, Math.round(H * 0.50), 'FOOTHOLD', {
      fontFamily: FONT, fontSize: '84px', fontStyle: 'bold', color: INK,
    }).setOrigin(0.5);
    // Tagline: the four verbs, each colored to its in-game action (gold/green/purple/orange),
    // laid out as separate centered words with a soft shadow so it reads as a styled strap line.
    const words = [
      { t: 'Expand.', c: '#ffce3a' },
      { t: 'Build.', c: '#57c97a' },
      { t: 'Upgrade.', c: '#b06bff' },
      { t: 'Siege.', c: '#ff6a3d' },
    ];
    const tagY = Math.round(H * 0.50) + 68, wgap = 14;
    const wobjs = words.map((w) => this.add.text(0, tagY, w.t, {
      fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: w.c,
    }).setOrigin(0, 0.5).setShadow(0, 2, '#000000', 4, false, true));
    const totalW = wobjs.reduce((s, o) => s + o.width, 0) + wgap * (wobjs.length - 1);
    let wx = cx - totalW / 2;
    wobjs.forEach((o) => { o.x = wx; wx += o.width + wgap; });

    // --- Buttons ---
    const startY = Math.round(H * 0.68);
    const start = this.button(cx, startY, 460, 104, 'Start', ACCENT, '#ffffff', 40, () => {
      sfx.play('newgame');
      this.scene.start('GameScene');
    });
    // A gentle breathing pulse on the primary CTA to pull the eye.
    this.tweens.add({ targets: start.objs, scale: { from: 1, to: 1.03 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.button(cx, startY + 128, 460, 84, 'How to Play', 0x323850, INK, 30, () => this.tutorial.show());

    // --- Settings gear (top-right) ---
    // Matches the game HUD's gear button exactly (same rounded card, 0x2a2e40 fill, 30px glyph,
    // transparent hit zone) so the control reads as the same button across both screens.
    const gW = 60, gH = 76, gxL = W - 20 - gW, gyT = 26;
    const gcx = gxL + gW / 2, gcy = gyT + gH / 2;
    this.add.graphics().fillStyle(0x2a2e40, 1).fillRoundedRect(gxL, gyT, gW, gH, 12);
    this.add.text(gcx, gcy, '⚙️', { fontFamily: FONT, fontSize: '30px' }).setOrigin(0.5);
    this.add.rectangle(gcx, gcy, gW, gH, 0x000000, 0.001).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.settingsPanel.show());

    // Version, bottom edge - small, unobtrusive, reads as a finished build.
    this.add.text(cx, H - 34, VERSION, { fontFamily: FONT, fontSize: '16px', color: '#5a6076' }).setOrigin(0.5);
  }

  // A filled pill button with a hover lift. Returns { objs } so callers can tween the group
  // (e.g. a breathing pulse). onTap fires on pointerdown.
  button(cx, y, w, h, labelText, color, textColor, fontSize, onTap) {
    // Geometry is centered on the graphics' OWN origin and the object is then moved to (cx,y),
    // so a scale tween (the CTA pulse) scales around the button's center, not the world origin.
    const g = this.add.graphics().fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.setPosition(cx, y);
    const label = this.add.text(cx, y, labelText, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: textColor }).setOrigin(0.5);
    const hit = this.add.rectangle(cx, y, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => label.setScale(1.04));
    hit.on('pointerout', () => label.setScale(1));
    hit.on('pointerdown', onTap);
    return { objs: [g, label] };
  }
}
