// Phaser bootstrapping. We load Phaser as a global from the CDN (see index.html),
// so it's referenced here as `Phaser` rather than imported.
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
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
    // Wide/desktop: fully centered. Portrait (mobile): center horizontally but pin to the TOP,
    // so any vertical letterbox slack falls to the BOTTOM — that keeps the mobile browser's
    // address bar over dead space instead of covering the bottom-anchored End Turn button.
    autoCenter: isWide ? Phaser.Scale.CENTER_BOTH : Phaser.Scale.CENTER_HORIZONTALLY,
    // Without this, the canvas backing store is 1 device pixel per design pixel, then the
    // browser upscales it via CSS to fit the real screen - on any high-DPI display (basically
    // every modern phone/laptop) that upscale is what makes all text and thin strokes look soft.
    // Matching the backing-store resolution to the device's pixel ratio renders everything at
    // full sharpness before the (now no-op) CSS scale.
    resolution: window.devicePixelRatio || 1,
  },
  // Register the CRT post-processing shader so the scene can attach it to its
  // camera. Classes extending PostFXPipeline are added as post pipelines here
  // and referenced by name ('CrtPipeline'). Ignored on the Canvas renderer.
  pipeline: { CrtPipeline },
  scene: [BootScene, TitleScene, LevelSelectScene, GameScene],
};

// Phaser rasterizes text to a canvas at create time, so a webfont that isn't loaded yet
// silently falls back to serif and never re-renders. Grenze (our display font for titles,
// headings, and buttons) is small, so wait for both weights before booting. document.fonts
// resolves per @font-face in style.css; we boot regardless on failure so a missing font can
// never block the game (it just falls back to the serif stack).
const bootGame = () => new Phaser.Game(config); // eslint-disable-line no-new
Promise.all([
  document.fonts.load('400 1em "Grenze"'),
  document.fonts.load('700 1em "Grenze"'),
]).then(bootGame, bootGame);
