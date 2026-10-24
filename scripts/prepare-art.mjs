// Bakes public-domain engraving scans into tritone plates: grayscale
// luminance mapped smoothly through shadow -> mid -> highlight colors.
//
// Usage: node scripts/prepare-art.mjs <dir-with-source-jpgs>
// Sources and licenses are listed in src/assets/art/CREDITS.md.
//
// Output is a high-quality webp source in src/assets/art. The site serves it
// through astro:assets as AVIF, which sharp encodes at 4:4:4 chroma, so thin
// neon lines stay sharp (webp's default 4:2:0 would smear them).
import sharp from "sharp";
import path from "node:path";

const outDir = path.resolve(import.meta.dirname, "../src/assets/art");

/* ---------------------------------------------------------------------------
 * Tuning
 *
 * stops     Shadow, mid and highlight colors.
 * midpoint  Where the mid color sits on the 0-1 tone scale. Lower = more of
 *           the plate reaches the highlight.
 * gamma     Applied to tone before mapping. > 1 darkens midtones (less neon),
 *           < 1 lightens them (more neon).
 * floor     Percentile (0-1) of the plate's own tones that is held at the
 *           shadow stop, so paper/empty areas render as the page background
 *           (#0f0a1a) and purple/neon carry only the line work. The remaining
 *           tones are stretched across shadow -> mid -> highlight.
 * invert    true maps ink to the highlight (neon line work); false maps
 *           paper to the highlight.
 * blur      Gaussian sigma in output pixels before mapping, so fine hatching
 *           becomes continuous tone instead of pixel speckle. 0 = off.
 * screen    Optional engraving line screen for tonal sources (mezzotints,
 *           paintings): { period, angle } in output px / degrees. Tone is
 *           rebuilt as parallel strokes whose width follows the tone, so
 *           the plate reads as engraved like the others.
 * crop      Fractions of the source image: [left, top, right, bottom].
 * enlarge   Allow upscaling (lanczos3) past the source size, for small
 *           scans that must still cover a 2x hero; pair with a little blur.
 * ------------------------------------------------------------------------- */
const defaults = {
  stops: ["#0f0a1a", "#3b1a7a", "#e6ff00"],
  midpoint: 0.55,
  gamma: 1.4,
  floor: 0.5,
  invert: true,
  blur: 0.6,
};

const plates = [
  // Hero (portrait).
  // The de Caus scan is only 922px wide after cropping, so it is upscaled
  // with a slightly heavier blur to read as soft ink rather than pixels.
  { name: "decaus", crop: [0.08, 0.18, 0.98, 0.96], width: 1100, enlarge: true, gamma: 1.4, blur: 1.1 },
  // Now band (wide). A mezzotint: tonal, so light maps to neon (not ink),
  // and a line screen rebuilds the smooth tone as engraved strokes.
  {
    name: "orrery", crop: [0.02, 0.1, 0.98, 0.82], width: 1800, invert: false,
    gamma: 0.42, midpoint: 0.38, floor: 0.45, blur: 0.6, screen: { period: 6.5, angle: -30 },
  },
  // Footer band (wide), cropped to the crown gear and lantern wheel.
  { name: "ramelli", crop: [0.2, 0.36, 0.8, 0.8], width: 1800, gamma: 2.3, midpoint: 0.84, blur: 1.6 },
  // Photos header.
  { name: "lute", crop: [0.045, 0.06, 0.91, 0.955], width: 1800, gamma: 1.2 },
];

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Tone value below which `fraction` of the pixels fall. */
function percentile(data, channels, fraction) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += channels) hist[data[i]]++;
  const target = fraction * (data.length / channels);
  let count = 0;
  for (let v = 0; v < 256; v++) {
    count += hist[v];
    if (count >= target) return v;
  }
  return 255;
}

/** 256-entry RGB lookup table for a plate's tone curve and stops. */
function buildLut({ stops, midpoint, gamma }, floorValue) {
  const [shadow, mid, highlight] = stops.map(rgb);
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = Math.pow(Math.max(0, (v - floorValue) / (255 - floorValue)), gamma);
    const [from, to, f] =
      t < midpoint
        ? [shadow, mid, t / midpoint]
        : [mid, highlight, (t - midpoint) / (1 - midpoint)];
    for (let k = 0; k < 3; k++) {
      lut[v * 3 + k] = Math.round(from[k] + (to[k] - from[k]) * f);
    }
  }
  return lut;
}

/**
 * Rebuild continuous tone as an engraving-style line screen: a pixel is
 * inked when its tone exceeds its distance from the nearest stroke center,
 * so strokes thicken with tone. Gaps drop to 0 (below the floor = page bg);
 * stroke pixels keep their tone, so color still follows the tritone.
 */
function lineScreen(data, info, { period, angle }) {
  const rad = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
  const aa = 1.5 / period; // ~1px antialiasing ramp
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const phase = ((x * cos + y * sin) / period) % 1;
      const dist = Math.abs((phase < 0 ? phase + 1 : phase) - 0.5) * 2;
      const tone = data[i] / 255;
      const ink = Math.min(1, Math.max(0, (tone - dist) / aa + 0.5));
      data[i] = Math.round(data[i] * ink);
    }
  }
}

/** Bake one plate from `srcPath` to a tritone webp at `outPath`. */
export async function bakePlate(srcPath, plate, outPath) {
  const opts = { ...defaults, ...plate };
  const input = sharp(srcPath);
  const { width: w, height: h } = await input.metadata();
  const [l, t, r, b] = opts.crop;

  let gray = input
    .extract({
      left: Math.round(l * w),
      top: Math.round(t * h),
      width: Math.round((r - l) * w),
      height: Math.round((b - t) * h),
    })
    .resize({ width: opts.width, withoutEnlargement: !opts.enlarge, kernel: "lanczos3" })
    .grayscale()
    .normalise({ lower: 1, upper: 99 });
  if (opts.invert) gray = gray.negate();
  if (opts.blur > 0) gray = gray.blur(opts.blur);

  const { data, info } = await gray.raw().toBuffer({ resolveWithObject: true });
  const floorValue = percentile(data, info.channels, opts.floor);
  if (opts.screen) lineScreen(data, info, opts.screen);
  const lut = buildLut(opts, floorValue);
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i++) {
    const v = data[i * info.channels];
    out[i * 3] = lut[v * 3];
    out[i * 3 + 1] = lut[v * 3 + 1];
    out[i * 3 + 2] = lut[v * 3 + 2];
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: 85, smartSubsample: true })
    .toFile(outPath);

  console.log(`wrote ${path.basename(outPath)} (${info.width}x${info.height}, floor at ${floorValue})`);
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const srcDir = process.argv[2];
  if (!srcDir) {
    console.error("Usage: node scripts/prepare-art.mjs <source-dir>");
    process.exit(1);
  }
  for (const plate of plates) {
    await bakePlate(
      path.join(srcDir, `${plate.name}.jpg`),
      plate,
      path.join(outDir, `${plate.name}.webp`)
    );
  }
}
