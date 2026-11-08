# ./visual — the matter of this repo's face

Forged per-repo, committed here so a `git clone` brings the whole face.
This is the MATTER; `../visual-identity.json` is the MANIFEST.

The manifest + the convention travel with the ADD methodology. The matter
does NOT — it is forged for THIS repo and never propagates to another.

Expected assets (drop them here, then point `background` in the manifest at
them):

- `background.png`       — the albedo (the picture)
- `background_depth.png` — the depth map (drives the parallax offset)

The albedo + depth pair drives a parallax offset in the shader (picture +
depth, offset by depth). Until the art is forged, `background` stays null in
the manifest — an honest stub, not a broken pointer.
