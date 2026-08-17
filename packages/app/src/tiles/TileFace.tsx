import React from 'react';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import type { TileKind } from '@mahjong/engine';
import { FACE_DATA, STICK_NODE, STICK_W, VIEWBOX, type FaceColor } from './tileData';
import { tokens, tileHeight } from '../theme/tokens';

/**
 * Renders one tile face from `FACE_DATA`.
 *
 * Pure SVG in a fixed 100×140 viewBox, scaled to whatever width it is given, so
 * one description serves the hand (44px), a meld (34px), the pond (30px) and an
 * opponent's mini tiles (22px) without separate assets.
 */

function colorOf(name: FaceColor): string {
  return tokens.color[name];
}

export interface TileFaceProps {
  tile: TileKind;
  /** Rendered width in px. Height follows the tile aspect ratio. */
  size?: number;
}

export function TileFace({ tile, size = tokens.tile.w }: TileFaceProps): React.ReactElement {
  const face = FACE_DATA[tile];
  const height = tileHeight(size);

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}>
      {face.kind === 'dots' && face.circles.map((c, i) => (
        <React.Fragment key={i}>
          <Circle cx={c.cx} cy={c.cy} r={c.r} fill={colorOf(c.color)} />
          {/* A lighter inner ring is what makes a dot read as carved rather
              than printed at 22px. */}
          <Circle
            cx={c.cx}
            cy={c.cy}
            r={c.r * 0.45}
            fill={tokens.color.tileFace}
            opacity={0.85}
          />
        </React.Fragment>
      ))}

      {face.kind === 'bamboo' && face.sticks.map((s, i) => {
        const half = face.stickHeight / 2;
        return (
          <React.Fragment key={i}>
            {/* The stick itself: an elongated capsule. This is what makes 條
                read as a LINE rather than a dot — the whole visual difference
                between this suit and 筒. */}
            <Rect
              x={s.x - STICK_W / 2}
              y={s.y - half}
              width={STICK_W}
              height={face.stickHeight}
              rx={STICK_W / 2}
              fill={colorOf(s.color)}
            />
            {/* Node lines. Narrower than the stick and hairline-thin, so they
                suggest bamboo segments without severing it. Proportions come
                from STICK_NODE so the "must not swallow the stick" rule is
                testable — see the note on that constant. */}
            {STICK_NODE.offsets.map((offset) => (
              <Rect
                key={offset}
                x={s.x - (STICK_W * STICK_NODE.widthRatio) / 2}
                y={s.y + face.stickHeight * offset
                  - (face.stickHeight * STICK_NODE.heightRatio) / 2}
                width={STICK_W * STICK_NODE.widthRatio}
                height={face.stickHeight * STICK_NODE.heightRatio}
                fill={tokens.color.tileFace}
                opacity={STICK_NODE.opacity}
              />
            ))}
          </React.Fragment>
        );
      })}

      {face.kind === 'glyph' && face.chars.map((char, i) => (
        <SvgText
          key={i}
          x={VIEWBOX.w / 2}
          y={glyphY(face.chars.length, i)}
          fontSize={glyphSize(face.chars.length)}
          fontFamily={tokens.font.cjk}
          fill={colorOf(face.colors[i] ?? 'inkPrimary')}
          textAnchor="middle"
        >
          {char}
        </SvgText>
      ))}

      {face.kind === 'frame' && (
        <Rect
          x={18}
          y={26}
          width={VIEWBOX.w - 36}
          height={VIEWBOX.h - 52}
          rx={6}
          fill="none"
          stroke={tokens.color.suitBlue}
          strokeWidth={5}
        />
      )}
    </Svg>
  );
}

/** One glyph sits centred; two stack (numeral above, 萬 below). */
function glyphY(count: number, index: number): number {
  if (count === 1) return 92;
  return index === 0 ? 62 : 122;
}

function glyphSize(count: number): number {
  return count === 1 ? 74 : 52;
}
