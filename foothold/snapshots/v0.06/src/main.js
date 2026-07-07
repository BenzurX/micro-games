// Phaser bootstrapping. We load Phaser as a global from the CDN (see index.html),
// so it's referenced here as `Phaser` rather than imported.
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CrtPipeline } from './lib/CrtPipeline.js';

// Mobile-first portrait resolution. We LOCK the width to 720 (so horizontal layout
// math stays simple and centered) but let the HEIGHT match the device's real aspect
// ratio. That way a tall modern phone (taller than the old 9:16 assumption) fills the
// screen top-to-bottom instead of showing dead letterbox bars. Scale.FIT then just
// scales this base to the canvas. Clamped so we never get an absurdly tall/short board:
// 1280 (classic 9:16) is the floor, 1800 the ceiling for very tall devices.
const aspectRatio = (window.innerHeight || 1280) / (window.innerWidth || 720);
const designHeight = Phaser.Math.Clamp(Math.round(720 * aspectRatio), 1280, 1800);

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1e2b',
  width: 720,
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
