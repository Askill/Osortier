import React from 'react';
import { Ellipse, Layer, Path, Rect, Text, dropShadow, interpolateColors, registerFont } from 'remotion';

// Editorial typeface: Georgia for titles and captions, Arial for labels (system fonts, not copied into the repo).
const FONT_DIR = 'C:/Windows/Fonts/';
registerFont({ family: 'Georgia', path: FONT_DIR + 'georgia.ttf' });
registerFont({ family: 'Georgia', path: FONT_DIR + 'georgiab.ttf', weight: 700 });
registerFont({ family: 'Arial', path: FONT_DIR + 'arial.ttf' });
registerFont({ family: 'Arial', path: FONT_DIR + 'arialbd.ttf', weight: 700 });
export const SERIF = 'Georgia';
export const SANS = 'Arial';

// Editorial colours
export const C = {
  bg: '#FFFFFF',
  ink: '#121212',
  grey: '#586173', // slate text: secondary labels
  slate: '#6E7A8A',
  soft: '#B5B5B5', // receded / parked
  hair: '#d8d8d8',
  stand: '#3a3a3a',
  red: '#E3120B',
  white: '#FFFFFF',
  a: '#006BA2',
  b: '#E3120B',
  c: '#6E7A8A',
};
export type LaneKey = 'a' | 'b' | 'c';
export const laneColor = (k: LaneKey) => C[k];

/** SCENE.md strokes take cap / join / dashArray; the 0.2.5 TS type only lists colour and width. */
type StrokeFull = { color: string; width: number; cap?: 'butt' | 'round' | 'square'; join?: 'miter' | 'round' | 'bevel'; dashArray?: number[]; dashOffset?: number };
export const stk = (s: StrokeFull) => s as any;

// ---------- time helpers ----------
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** smootherstep: the calm in-out curve used for every move */
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** eased progress of a tween that starts at frame a and lasts d frames */
export const tw = (f: number, a: number, d: number, e: (t: number) => number = smooth) => e((f - a) / Math.max(1, d));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = (c1: string, c2: string, t: number) => interpolateColors(clamp01(t), [0, 1], [c1, c2]);
/** 0 -> 1 -> 0 bump over d frames from a */
export const bump = (f: number, a: number, d: number) => {
  const q = (f - a) / d;
  return q <= 0 || q >= 1 ? 0 : Math.sin(Math.PI * q);
};
/** opacity of something shown from t0 to t1 with soft edges */
export const window01 = (f: number, t0: number, t1: number, fin = 14, fout = 12) =>
  tw(f, t0, fin) * (1 - tw(f, t1 - fout, fout));

// ---------- text ----------
export type Seg = [string, string];
export function segChars(segs: Seg[]) {
  const text = segs.map((s) => s[0]).join('');
  const chars: { color: string }[] = [];
  for (const [t, col] of segs) for (const _ of Array.from(t)) chars.push({ color: col });
  return { text, chars };
}

type TP = {
  x: number;
  y: number;
  text?: string;
  segs?: Seg[];
  size: number;
  /** kept from the baseline call sites; labels are all set in the sans face now */
  mono?: boolean;
  serif?: boolean;
  weight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  opacity?: number;
  chars?: any;
  id?: string;
};
/** Text whose (x, y) is the anchor point given by `align`, vertically at the cap-height centre. */
export const T: React.FC<TP> = ({ x, y, text, segs, size, serif = false, weight, color = C.ink, align = 'center', opacity = 1, chars, id }) => {
  if (opacity <= 0.002) return null;
  let str = text ?? '';
  let ch = chars;
  if (segs) {
    const sc = segChars(segs);
    str = sc.text;
    ch = chars ?? sc.chars;
  }
  const k = serif ? 0.578 : 0.563;
  const W = Math.min(1860, Math.ceil(Array.from(str).length * size * 0.64 + 40));
  const left = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x;
  return (
    <Text
      id={id}
      x={left}
      y={y - k * size}
      size={size}
      font={serif ? SERIF : SANS}
      weight={weight ?? 400}
      lineHeight={1.15}
      color={color}
      maxWidth={W}
      align={align}
      opacity={opacity}
      chars={ch}
    >
      {str}
    </Text>
  );
};

// ---------- chips ----------
export const chipLabel = (s: string, sn: number, d: string, dn: number) => `${s}${sn}→${d}${dn}`;
export const chipDims = (size: number) => ({ w: 4.4 * size, h: 1.72 * size });
/** centre of the source / destination half of a chip's label, relative to the chip centre */
export const chipPartDx = (size: number) => 1.12 * size;

export const Chip: React.FC<{
  x: number;
  y: number;
  s: LaneKey;
  sn: number;
  d: LaneKey;
  dn: number;
  size?: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  bgOpacity?: number;
  textOpacity?: number;
  arrowOpacity?: number;
  shadow?: boolean;
}> = ({ x, y, s, sn, d, dn, size = 30, opacity = 1, rotation = 0, scale = 1, bgOpacity = 1, textOpacity = 1, arrowOpacity = 1, shadow = true }) => {
  if (opacity <= 0.002) return null;
  const { w, h } = chipDims(size);
  const gap = 0.52 * size;
  return (
    <Layer x={x} y={y} rotation={rotation} scale={scale} opacity={opacity}>
      {bgOpacity > 0.002 && (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          radius={size * 0.36}
          fill={C.white}
          stroke={{ color: C.hair, width: 1.5 }}
          opacity={bgOpacity}
          effects={shadow ? [dropShadow({ y: 3, blur: 9, color: '#12121214' })] : []}
        />
      )}
      <T x={-gap} y={0} text={`${s}${sn}`} size={size} weight={700} color={C[s]} align="right" opacity={textOpacity} />
      <T x={0} y={0} text="→" size={size} color={C.slate} opacity={textOpacity * arrowOpacity} />
      <T x={gap} y={0} text={`${d}${dn}`} size={size} weight={700} color={C[d]} align="left" opacity={textOpacity} />
    </Layer>
  );
};

// ---------- dots, bars, lanes ----------
/** emit: 0 = parked (outlined, greyed), 1 = emitted (filled). ghost = not arrived yet (dashed ink). */
export const Dot: React.FC<{
  x: number;
  y: number;
  r?: number;
  color: string;
  num?: number | string;
  emit?: number;
  ghost?: boolean;
  opacity?: number;
  scale?: number;
  numOpacity?: number;
  parkedGrey?: number;
}> = ({ x, y, r = 26, color, num, emit = 0, ghost = false, opacity = 1, scale = 1, numOpacity = 1, parkedGrey = 0.45 }) => {
  if (opacity <= 0.002) return null;
  const parkedStroke = mix(color, C.soft, parkedGrey);
  const fill = ghost ? C.bg : mix(C.bg, color, emit);
  const stroke = ghost ? C.ink : mix(parkedStroke, color, emit);
  const ncol = ghost ? C.ink : mix(parkedStroke, C.white, emit);
  const sw = r > 16 ? 3 : 2.2;
  return (
    <Layer x={x} y={y} scale={scale} opacity={opacity}>
      <Ellipse
        x={-r}
        y={-r}
        width={2 * r}
        height={2 * r}
        fill={fill}
        stroke={stk(ghost ? { color: stroke, width: sw, dashArray: [r * 0.3, r * 0.22] } : { color: stroke, width: sw })}
      />
      {num !== undefined && <T x={0} y={0} text={String(num)} size={r * 0.95} weight={700} color={ncol} opacity={numOpacity} />}
    </Layer>
  );
};

export const Line: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  opacity?: number;
  dash?: number[];
  cap?: 'butt' | 'round' | 'square';
  effects?: any[];
}> = ({ x1, y1, x2, y2, color, width = 3, opacity = 1, dash, cap = 'round', effects }) => {
  if (opacity <= 0.002) return null;
  if (Math.abs(x2 - x1) < 0.01 && Math.abs(y2 - y1) < 0.01) return null;
  return (
    <Path
      d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`}
      stroke={stk(dash ? { color, width, cap, dashArray: dash } : { color, width, cap })}
      opacity={opacity}
      effects={effects}
    />
  );
};

export const Ring: React.FC<{ x: number; y: number; r: number; color: string; width?: number; opacity?: number; dash?: number[] }> = ({
  x,
  y,
  r,
  color,
  width = 3,
  opacity = 1,
  dash,
}) => {
  if (opacity <= 0.002 || r <= 0) return null;
  return (
    <Ellipse
      x={x - r}
      y={y - r}
      width={2 * r}
      height={2 * r}
      stroke={stk(dash ? { color, width, dashArray: dash } : { color, width })}
      opacity={opacity}
    />
  );
};

/** bar colour for an event: parked grey -> emitted ink */
export const barColor = (emit: number) => mix('#cfcfcf', '#121212', emit);

export const Lane: React.FC<{ k: LaneKey; y: number; x0: number; x1: number; draw: number; labelX: number; opacity?: number; labelSize?: number }> = ({
  k,
  y,
  x0,
  x1,
  draw,
  labelX,
  opacity = 1,
  labelSize = 44,
}) => {
  if (opacity <= 0.002) return null;
  return (
    <Layer opacity={opacity}>
      <Line x1={x0} y1={y} x2={lerp(x0, x1, draw)} y2={y} color={C[k]} width={3} opacity={0.38 * clamp01(draw * 8)} />
      <T x={labelX} y={y} text={k} size={labelSize} weight={700} color={C[k]} opacity={clamp01(draw * 3)} />
    </Layer>
  );
};

/** quadratic arc (x1,y)->(x2,y) bulging by h (negative = up), drawn to progress p, with an arrowhead */
export const Arc: React.FC<{ x1: number; y1: number; x2: number; y2: number; h: number; p: number; color: string; width?: number; opacity?: number; head?: boolean }> = ({
  x1,
  y1,
  x2,
  y2,
  h,
  p,
  color,
  width = 3,
  opacity = 1,
  head = true,
}) => {
  if (opacity <= 0.002 || p <= 0.001) return null;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + h;
  // sample to get the length and the point / tangent at p
  const N = 40;
  let len = 0;
  let px = x1;
  let py = y1;
  const pts: [number, number][] = [[x1, y1]];
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const qx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const qy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    len += Math.hypot(qx - px, qy - py);
    px = qx;
    py = qy;
    pts.push([qx, qy]);
  }
  const t = clamp01(p);
  const ex = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const ey = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  const dx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
  const dy = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
  const ang = Math.atan2(dy, dx);
  const hl = 13;
  const hw = 7;
  const bx = ex - Math.cos(ang) * hl;
  const by = ey - Math.sin(ang) * hl;
  const nx = -Math.sin(ang) * hw;
  const ny = Math.cos(ang) * hw;
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  return (
    <Layer opacity={opacity}>
      <Path d={d} stroke={stk({ color, width, cap: 'round', dashArray: [len * t, len * 2 + 10] })} />
      {head && t > 0.15 && (
        <Path d={`M ${ex} ${ey} L ${bx + nx} ${by + ny} L ${bx - nx} ${by - ny} Z`} fill={color} />
      )}
    </Layer>
  );
};

export const Caption: React.FC<{ f: number; caps: { t0: number; t1: number; text: string }[]; x?: number; y?: number; size?: number }> = ({ f, caps, x = 960, y = 64, size = 38 }) => (
  <>
    {caps.map((c, i) => {
      const o = window01(f, c.t0, c.t1, 14, 12);
      if (o <= 0.002) return null;
      return <T key={i} x={x} y={y + 10 * (1 - tw(f, c.t0, 14))} text={c.text} size={size} serif weight={700} color={C.ink} opacity={o} />;
    })}
  </>
);

// ---------- pause after each caption ----------
export type Cap = { t0: number; t1: number; text: string };
/** frames a caption takes to finish appearing (Caption fades in over 14) */
export const CAP_IN = 14;
/** extra rest at the end of the title and closing cards, once their motion is done: 1.5 s */
export const PAUSE = 45;
/**
 * Plays a scene at its baseline rate. `speed` is the scene's playback rate over its script
 * frames. Captions no longer freeze the picture: holding mid-motion looked broken.
 * Returns the scene's script frame for a real frame, and the frames added (none).
 */
export function makePause(_caps: Cap[], speed = 1) {
  return { map: (real: number) => real * speed, extra: 0 };
}
