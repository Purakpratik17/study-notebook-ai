/**
 * One-off generator: rasterizes src/assets/cerevyn-emblem.svg into the Android
 * launcher icon densities + adaptive-icon foregrounds, and the full logo into
 * splash screens. Run with: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import path from "path";

const root = process.cwd();
const emblem = readFileSync(path.join(root, "src/assets/cerevyn-emblem.svg"));
const logo = readFileSync(path.join(root, "src/assets/cerevyn-logo.svg"));

const iconDirs = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];
const fgDirs = [
  ["mipmap-mdpi", 108],
  ["mipmap-hdpi", 162],
  ["mipmap-xhdpi", 216],
  ["mipmap-xxhdpi", 324],
  ["mipmap-xxxhdpi", 432],
];
const splashDirs = [
  ["drawable", 480],
  ["drawable-land-hdpi", 800],
  ["drawable-land-mdpi", 480],
  ["drawable-land-xhdpi", 960],
  ["drawable-land-xxhdpi", 1440],
  ["drawable-port-hdpi", 800],
  ["drawable-port-mdpi", 480],
  ["drawable-port-xhdpi", 960],
  ["drawable-port-xxhdpi", 1440],
];

const res = path.join(root, "android/app/src/main/res");

for (const [dir, size] of iconDirs) {
  await sharp(emblem, { density: 400 })
    .resize(size, size)
    .png()
    .toFile(path.join(res, dir, "ic_launcher.png"));
  await sharp(emblem, { density: 400 })
    .resize(size, size)
    .png()
    .toFile(path.join(res, dir, "ic_launcher_round.png"));
  console.log("icon", dir, size);
}

// Adaptive icon foreground: emblem centered with generous safe-zone padding
for (const [dir, size] of fgDirs) {
  const inner = Math.round(size * 0.62);
  const pad = Math.round((size - inner) / 2);
  const img = await sharp(emblem, { density: 400 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 250, g: 245, b: 233, alpha: 1 } },
  })
    .composite([{ input: img, top: pad, left: pad }])
    .png()
    .toFile(path.join(res, dir, "ic_launcher_foreground.png"));
  console.log("fg", dir, size);
}

for (const [dir, width] of splashDirs) {
  const width2 = width * 2; // crisp
  const logoBuf = await sharp(logo, { density: 300 })
    .resize(Math.round(width2 * 0.6))
    .png()
    .toBuffer();
  const meta = await sharp(logoBuf).metadata();
  const height2 = Math.round(width2 * (480 / 960));
  await sharp({
    create: { width: width2, height: height2, channels: 4, background: { r: 250, g: 245, b: 233, alpha: 1 } },
  })
    .composite([
      {
        input: logoBuf,
        top: Math.max(0, Math.round((height2 - (meta.height ?? 0)) / 2)),
        left: Math.max(0, Math.round((width2 - (meta.width ?? 0)) / 2)),
      },
    ])
    .png()
    .toFile(path.join(res, dir, "splash.png"));
  console.log("splash", dir, width2);
}
console.log("done");
