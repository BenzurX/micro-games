// BootScene: entry point. Loads the shared UI icons, then hands off to GameScene.
// Icons are single-color SVGs (white fill) rasterized here and tinted per-resource at
// draw time, so one file serves both the HUD counters and the on-board nodes.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Kenney "Board Game Icons" (CC0). d2→gold, resource_lumber→wood, resource_wood→stone
    // (the brick-like log tinted grey; pack has no stone icon), award→special, watchtower→home,
    // card_lift→upgrade marker. Rasterize at 128px so they stay crisp when scaled up on retina.
    const icons = ['gold', 'wood', 'stone', 'special', 'upgrade'];
    icons.forEach((key) => this.load.svg(`ic_${key}`, `assets/icons/${key}.svg`, { width: 128, height: 128 }));
    // Home base uses the watchtower shape — your keep on the board.
    this.load.svg('ic_home', 'assets/icons/watchtower.svg', { width: 128, height: 128 });
    // Back-nav chevron (arrow_right, mirrored) - replaces the plain '←' text glyph.
    this.load.svg('ic_back', 'assets/icons/arrow_back.svg', { width: 128, height: 128 });
    // Settings gear (Ben's own artwork) - replaces the '⚙️' emoji glyph.
    this.load.svg('ic_gear', 'assets/icons/gear.svg', { width: 128, height: 128 });
    // Watchtower hero art for the title screen (Kenney Board Game Icons, CC0; white-filled → tintable).
    this.load.image('watchtower', 'assets/watchtower.png');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
