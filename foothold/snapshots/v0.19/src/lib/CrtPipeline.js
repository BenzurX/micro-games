// CrtPipeline: a WebGL post-processing shader that gives the whole game a subtle
// old-CRT look — a gentle barrel curve, scanlines, a faint phosphor grille, soft
// bloom, and a vignette. This is the "A+" variant we staged (stage/crt-filter.html):
// A's readable glow intensity plus a *slight* screen bend, far short of a full CRT.
//
// A post-processing pipeline runs AFTER the scene is drawn, taking the finished
// frame as a texture (uMainSampler) and re-drawing every pixel through this shader.
// It only works on the WebGL renderer; on a Canvas fallback the game runs unfiltered
// (see GameScene.applyCrt), so nothing breaks — you just don't get the effect.
//
// Tuning: every knob lives in CRT below. Set `enabled: false` to turn the whole
// thing off, or `warp: 0` to drop the curve and get flat "A". These are read live
// each frame, so tweaking them and reloading is instant — no shader edits needed.

export const CRT = {
  enabled: true,
  warp: 0.018,      // barrel-curve strength. 0 = flat (variant A). B used 0.05 (too much).
  scanAlpha: 0.13,  // scanline darkness (0..1). Higher = more visible horizontal lines.
  scanPeriod: 6,    // buffer-pixels between scanlines. Lower = denser lines.
  grille: 0.03,     // per-column R/G/B phosphor tint strength. 0 = off.
  bloom: 0.28,      // additive soft-glow amount from bright pixels. 0 = off.
  vignette: 0.16,   // corner/edge darkening (0..1). Kept gentle so the slab edges don't crush to black.
};

// The fragment shader. Runs once per output pixel. `outTexCoord` is this pixel's
// 0..1 position in the frame; `uMainSampler` is the rendered scene.
const FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uWarp;
uniform float uScanAlpha;
uniform float uScanCount;
uniform float uGrille;
uniform float uBloom;
uniform float uVignette;

varying vec2 outTexCoord;

void main () {
  vec2 uv = outTexCoord;

  // --- Barrel curve --------------------------------------------------------
  // Map each output pixel back to a source pixel pushed slightly OUTWARD from
  // center (same inverse-map we used in the staged preview). Near the edges the
  // source lands past the frame, so the corners round off into black glass.
  vec2 n = uv * 2.0 - 1.0;                 // center-origin coords, -1..1
  float f = 1.0 + uWarp * dot(n, n);        // stronger the further from center
  vec2 suv = n * f * 0.5 + 0.5;             // back to 0..1 texture space

  // Off the curved glass → the game's dark-navy background (NOT pure black), so the
  // rounded corners blend into the letterbox/backdrop instead of reading as hard black.
  if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) {
    gl_FragColor = vec4(0.106, 0.118, 0.169, 1.0); // #1b1e2b, matches config.backgroundColor
    return;
  }

  vec3 col = texture2D(uMainSampler, suv).rgb;

  // --- Bloom ---------------------------------------------------------------
  // Cheap 8-tap ring blur added back on top: bright pixels (UI text, the lit
  // river channel) bleed a soft halo, like phosphor glow. Subtle at uBloom~0.28.
  if (uBloom > 0.0) {
    vec2 px = 2.2 / uResolution;
    vec3 b = vec3(0.0);
    b += texture2D(uMainSampler, suv + vec2( px.x, 0.0)).rgb;
    b += texture2D(uMainSampler, suv + vec2(-px.x, 0.0)).rgb;
    b += texture2D(uMainSampler, suv + vec2(0.0,  px.y)).rgb;
    b += texture2D(uMainSampler, suv + vec2(0.0, -px.y)).rgb;
    b += texture2D(uMainSampler, suv + vec2( px.x,  px.y)).rgb;
    b += texture2D(uMainSampler, suv + vec2(-px.x,  px.y)).rgb;
    b += texture2D(uMainSampler, suv + vec2( px.x, -px.y)).rgb;
    b += texture2D(uMainSampler, suv + vec2(-px.x, -px.y)).rgb;
    col += (b * 0.125) * uBloom;
  }

  // --- Scanlines -----------------------------------------------------------
  // Darken in a soft horizontal wave. uScanCount full cycles top-to-bottom.
  float scan = 0.5 + 0.5 * sin(suv.y * uScanCount * 6.2831853);
  col *= 1.0 - uScanAlpha * scan;

  // --- Aperture grille -----------------------------------------------------
  // Tint each screen column slightly toward R, G, or B in a repeating triad,
  // mimicking a CRT's phosphor stripes. Uses real pixel columns (gl_FragCoord).
  if (uGrille > 0.0) {
    float ci = mod(gl_FragCoord.x, 3.0);
    vec3 g = ci < 1.0 ? vec3(1.0 + uGrille, 1.0 - uGrille, 1.0 - uGrille)
           : ci < 2.0 ? vec3(1.0 - uGrille, 1.0 + uGrille, 1.0 - uGrille)
                      : vec3(1.0 - uGrille, 1.0 - uGrille, 1.0 + uGrille);
    col *= g;
  }

  // --- Vignette ------------------------------------------------------------
  // Darken toward the corners like a real tube. Measured from the un-warped uv
  // so the darkening tracks the physical screen, not the curved sample.
  float d = length(uv - 0.5);
  col *= 1.0 - uVignette * smoothstep(0.35, 0.75, d);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Turn the CRT filter on/off for a scene's main camera at runtime. Used both on scene create
// (seeding from the saved setting) and live when the player flips the toggle in Settings.
// `on` is the user's choice; CRT.enabled is a hard master killswitch that overrides it. The
// shader only exists on WebGL, so on a Canvas fallback this is a harmless no-op.
export function setSceneCrt(scene, on) {
  const active = on && CRT.enabled;
  // Canvas-level phosphor flicker (CSS, see style.css). Driven off the CRT setting via a class on
  // the game host, so it rides along with the filter and works even on the Canvas renderer.
  const host = scene.game.canvas && scene.game.canvas.parentElement;
  if (host) host.classList.toggle('crt', active);

  if (scene.renderer.type !== Phaser.WEBGL) return;
  // A PostFX pipeline clears its off-screen target to TRANSPARENT (not config.backgroundColor);
  // giving the camera its own opaque navy bg makes the rounded-corner surround read as the normal
  // backdrop instead of black. Harmless to set even when the filter is off.
  scene.cameras.main.setBackgroundColor('#1b1e2b');
  if (active) scene.cameras.main.setPostPipeline('CrtPipeline');
  else scene.cameras.main.resetPostPipeline();
}

// A corner control's tap target needs to sit where the button VISUALLY appears under the
// barrel warp above, not where it's logically drawn. The shader samples each output pixel's
// color from n*f(n) (n = center-origin coord, f(n) = 1 + warp*|n|^2), which pulls the apparent
// position of anything drawn at n0 inward, toward center, by roughly n0*(1 - warp*|n0|^2)
// (first-order inverse, valid since CRT.warp is small). Phaser's input hit-testing works in
// unwarped scene coordinates and never sees that displacement, so a hit rect centered on the
// button's true (cx,cy) sits off toward the corner from where the eye - and the tap - actually
// land. This re-centers the hit rect on the apparent position instead.
export function addCrtSafeHit(scene, cx, cy, w, h, pad = 0) {
  let ox = cx, oy = cy;
  if (CRT.enabled && scene.renderer.type === Phaser.WEBGL) {
    const W = scene.scale.gameSize.width, H = scene.scale.gameSize.height;
    const nx = (cx / W) * 2 - 1, ny = (cy / H) * 2 - 1;
    const k = CRT.warp * (nx * nx + ny * ny);
    const vnx = nx * (1 - k), vny = ny * (1 - k);
    ox = ((vnx + 1) / 2) * W;
    oy = ((vny + 1) / 2) * H;
  }
  return scene.add.rectangle(ox, oy, w + pad * 2, h + pad * 2, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });
}

export class CrtPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({ game, name: 'CrtPipeline', fragShader: FRAG });
  }

  // Push the live CRT knobs into the shader every frame, so tweaking the CRT
  // object above (or a future settings slider) takes effect without a rebuild.
  onPreRender() {
    const w = this.renderer.width;
    const h = this.renderer.height;
    this.set2f('uResolution', w, h);
    this.set1f('uWarp', CRT.warp);
    this.set1f('uScanAlpha', CRT.scanAlpha);
    this.set1f('uScanCount', h / Math.max(1, CRT.scanPeriod));
    this.set1f('uGrille', CRT.grille);
    this.set1f('uBloom', CRT.bloom);
    this.set1f('uVignette', CRT.vignette);
  }
}
