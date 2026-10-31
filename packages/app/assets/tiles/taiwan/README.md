# Taiwan tile faces

The 42 tile faces drawn for Taiwanese mahjong by samoheen, from
<https://github.com/samoheen/mahjong-tiles> (`taiwan/svg`, commit `8b5a3cd`).
They are public domain (CC0), so no credit line or other condition applies. See
`LICENSE.md`.

The files are kept exactly as published. The app does not read them at run
time. `scripts/build-tile-art.mjs` turns them into
`src/tiles/art/taiwan.generated.ts`, so after changing a file here, run:

    node scripts/build-tile-art.mjs
