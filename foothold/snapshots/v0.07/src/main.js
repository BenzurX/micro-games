// Phaser bootstrapping. We load Phaser as a global from the CDN (see index.html),
// so it's referenced here as `Phaser` rather than imported.
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CrtPipeline } from './lib/CrtPipeline.js';

// Mobile-first, responsive-up. The window's shape at load picks one of two design
// canvases, and every scene lays itself out from the canvas size it booted with:
//   • Portrait (phones, portrait tablets): width LOCKED to 720, height matched to the
//     device aspect (clamped 1280-1800) so tall phones fill top-to-bottom, no letterbox.
//   • Wide (landscape tablets / desktop): height LOCKED to 900, width matched to the
//     aspect (clamped 1200-1700). GameScene then switches to its board-left / info-rail-
//     right composition (see computeLayout).
// Scale.FIT scales whichever canvas we picked to the real window. The mode is chosen
// once at load; resizing across the portrait/landscape boundary needs a reload.
const ww = window.innerWidth || 720;
const wh = window.innerHeight || 1280;
const isWide = ww > wh;
const designWidth = isWide
  ? Phaser.Math.Clamp(Math.round(900 * (ww / wh)), 1200, 1700)
  : 720;
const designHeight = isWide
  ? 900
  : Phaser.Math.Clamp(Math.round(720 * (wh / ww)), 1280, 1800);

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1e2b',
  width: designWidth,
  height: designHeight,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Register the CRT post-processing shader so the scene can attach it to its
  // camera. Classes extending PostFXPipeline are added as post pipelines here
  // and referenced by name ('CrtPipeline'). Ignored on the Canvas renderer.
  pipeline: { CrtPipeline },
  scene: [BootScene, TitleScene, GameScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
