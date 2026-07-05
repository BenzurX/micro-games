// BootScene: entry point. For the prototype there are no assets to preload (we draw
// everything with shapes/text), so it just hands off to GameScene immediately.
// Later this is where we'll load the atlas, fonts, and audio.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.scene.start('GameScene');
  }
}
