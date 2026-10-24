import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PhotoModule = { default: ImageMetadata };

const photoModules = import.meta.glob<PhotoModule>(
  "../assets/photos/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}",
  { eager: true }
);

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function getAddedAt(filePath: string): number {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%ct", "--", filePath],
      { encoding: "utf8" }
    ).trim();
    if (out) return parseInt(out, 10) * 1000;
  } catch {
    // git not available or file not tracked — fall through
  }
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/** All photos in src/assets/photos, newest (by git add date) first. */
export function getPhotos(): { image: ImageMetadata; addedAt: number }[] {
  return Object.entries(photoModules)
    .map(([relativePath, mod]) => ({
      image: mod.default,
      addedAt: getAddedAt(path.resolve(currentDir, relativePath)),
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}
