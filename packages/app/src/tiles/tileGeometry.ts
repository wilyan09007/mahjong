/**
 * How a tile body of a given size is divided up.
 *
 * Seen from the player's chair, a real tile shows its face and, along the
 * bottom, its thickness: a band of ivory body and below that the green back.
 * Those two bands are what make a flat rectangle read as an object you could
 * pick up, so they never drop below a pixel even on the 18px mini tiles.
 *
 * Every number scales with the tile. A fixed 7px radius, which this replaced,
 * was a fifth of a 36px tile's width and made the set look like sweets.
 */

export interface TileGeometry {
  radius: number;
  /** The ivory side of the tile, under the face. */
  ivoryBand: number;
  /** The green back, under the ivory. */
  backBand: number;
  /** Clear ivory between the face's edge and its art. */
  inset: number;
  /** The box the art is fitted into. */
  face: { width: number; height: number };
}

export function tileGeometry(width: number, height: number): TileGeometry {
  const short = Math.min(width, height);
  const radius = Math.max(1.5, short * 0.11);
  const ivoryBand = Math.max(1, height * 0.045);
  const backBand = Math.max(1, height * 0.05);
  const inset = Math.max(0.5, short * 0.03);
  return {
    radius,
    ivoryBand,
    backBand,
    inset,
    face: {
      width: width - 2 * inset,
      height: height - ivoryBand - backBand - 2 * inset,
    },
  };
}
