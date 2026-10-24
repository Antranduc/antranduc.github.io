# [tranduc.dev](https://tranduc.dev)

My personal website.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is in `dist/`.

## Artwork

The tinted engravings live in `src/assets/art/` and are baked with `scripts/prepare-art.mjs`, which maps each scan's brightness to a three-color tritone (tuning config at the top of the script). Sources and licenses are in `src/assets/art/CREDITS.md`; only public-domain or CC0 works are used.

```bash
node scripts/prepare-art.mjs <dir-with-source-jpgs>
```

## Photos

Photos live in `src/assets/photos/` and are rendered on `/photos`, sorted newest-first by git commit timestamp. To publish a photo, drop it into that folder, commit, and push — the GitHub Pages workflow rebuilds the site.

Since this repo is public, a pre-commit hook strips EXIF metadata (GPS, camera serial, timestamps) from staged photos so originals aren't leaked. One-time setup per clone:

```bash
brew install exiftool jhead jpeg-turbo
git config core.hooksPath .githooks
```

The hook lives at `.githooks/pre-commit` and only touches files under `src/assets/photos/`. For JPEGs it runs `jhead -autorot` (which uses `jpegtran` under the hood) to losslessly bake the EXIF Orientation tag into the pixels — otherwise stripping EXIF would leave vertical photos displaying sideways. It then runs `exiftool -all=` to wipe metadata. The hook aborts the commit if any of these tools is missing or if rotation reports an error.
