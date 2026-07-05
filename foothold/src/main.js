// Phaser bootstrapping. We load Phaser as a global from the CDN (see index.html),
// so it's referenced here as `Phaser` rather than imported.
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';

// A portrait-ish design resolution. Phaser's Scale.FIT letterboxes this to any
// screen while keeping our layout math simple (we always draw to 720x1280).
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1e2b',
  width: 720,
  height: 1280,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
