import React from 'react';
import { Layer } from 'remotion';
import {
  C,
  Caption,
  Chip,
  Dot,
  LaneKey,
  Lane,
  Line,
  Ring,
  Seg,
  T,
  barColor,
  bump,
  chipPartDx,
  clamp01,
  easeOut,
  lerp,
  mix,
  smooth,
  tw,
  window01,
} from './lib';

// ---------- the canonical 6-event example ----------
export type BEv = { id: string; s: LaneKey; sn: number; d: LaneKey; dn: number; col: number };
// col = position in the true release order
export const EV: BEv[] = [
  { id: 'e1', s: 'a', sn: 0, d: 'b', dn: 0, col: 0 },
  { id: 'e2', s: 'b', sn: 1, d: 'c', dn: 0, col: 1 },
  { id: 'e3', s: 'a', sn: 1, d: 'c', dn: 1, col: 2 },
  { id: 'e4', s: 'a', sn: 2, d: 'b', dn: 2, col: 3 },
  { id: 'e5', s: 'c', sn: 2, d: 'b', dn: 3, col: 4 },
  { id: 'e6', s: 'a', sn: 3, d: 'c', dn: 3, col: 5 },
];
export const evById = (id: string) => EV.find((e) => e.id === id)!;
export const LANES: LaneKey[] = ['a', 'b', 'c'];

export const G = {
  laneY: { a: 480, b: 620, c: 760 } as Record<LaneKey, number>,
  x0: 420,
  x1: 1490,
  colX: (i: number) => 545 + i * 175,
  labelX: 372,
  inboxX: 960,
  inboxY: 300,
  verdictY: 362,
  outY: 884,
  R: 26,
  counterX: 1548,
  counterNumX: 1702,
};

export type Wake = { lane: LaneKey; from: number; to: number; t: number; dur: number; kind: 'emit' | 'stay' | 'none' | 'out' };
export type BLabel = { t0: number; t1: number; x: number; y: number; segs: Seg[]; size?: number; mono?: boolean };
export type BoardScript = {
  lanesIn: number;
  ev: Record<string, { arrive: number; land: number; emit: number | null; verdict?: Seg[] }>;
  ghostsIn: number;
  stallIn: number;
  wakes: Wake[];
  labels: BLabel[];
  captions: { t0: number; t1: number; text: string }[];
  rules: { t: number; y: number; segs: Seg[]; mono?: boolean; size?: number }[];
  stays: { id: string; t: number }[];
  settle: number;
  /** caption centre x (the GIF is cropped off-centre) */
  capX?: number;
  /** handled transactions recede to grey while the focus is elsewhere */
  recede?: { ids: string[]; t0: number; t1: number }[];
  /** secondary rule lines recede after their moment */
  ruleFocus?: { t0: number; t1: number }[];
};

export const FLY = 22;

// verdict helpers
const g = C.grey;
export const vPark = (k: LaneKey, have: number, need: number): Seg[] => [
  ['emitted[', g],
  [k, C[k]],
  [`] = ${have}, needs ${need}`, g],
  [':  ', g],
  ['park', C.ink],
];
export const vEmit = (k1: LaneKey, v1: number, k2: LaneKey, v2: number): Seg[] => [
  ['emitted[', g],
  [k1, C[k1]],
  [`] = ${v1} ✓   emitted[`, g],
  [k2, C[k2]],
  [`] = ${v2} ✓`, g],
  [':  ', g],
  ['emit', C.ink],
];

const emitOf = (S: BoardScript, id: string) => S.ev[id].emit;

export const Board: React.FC<{ f: number; S: BoardScript }> = ({ f, S }) => {
  const R = G.R;
  const lanesDraw = tw(f, S.lanesIn, 34);
  const uiIn = tw(f, S.lanesIn + 18, 20);

  const recedeOf = (id: string) => {
    let r = 0;
    for (const w of S.recede ?? []) if (w.ids.includes(id)) r = Math.max(r, window01(f, w.t0, w.t1, 18, 18));
    return r;
  };
  // per-event geometry
  const geo = EV.map((e) => {
    const s = S.ev[e.id];
    const tx = G.colX(e.col);
    const ys = G.laneY[e.s];
    const yd = G.laneY[e.d];
    const flyT0 = s.land - FLY;
    const p = tw(f, flyT0, FLY);
    const dx = chipPartDx(32);
    let shake = 0;
    for (const st of S.stays) if (st.id === e.id && f >= st.t && f <= st.t + 26) shake += Math.sin((f - st.t) * 0.95) * 7 * (1 - (f - st.t) / 26);
    const sx = lerp(G.inboxX - dx, tx, p) + shake;
    const sy = lerp(G.inboxY, ys, p);
    const dX = lerp(G.inboxX + dx, tx, p) + shake;
    const dY = lerp(G.inboxY, yd, p);
    const visible = f >= flyT0;
    const em = s.emit === null ? 0 : tw(f, s.emit, 12);
    const pop = s.emit === null ? 0 : bump(f, s.emit, 16);
    const settlePop = bump(f, S.settle + e.col * 4, 16) * 0.12;
    const rec = recedeOf(e.id);
    return { e, s, sx, sy, dX, dY, p, visible, em, pop, settlePop, tx, ys, yd, rec };
  });

  // ---------- stall glow ----------
  const stall = LANES.map((k, li) => {
    const evs = EV.filter((e) => e.s === k || e.d === k).sort((a, b) => a.col - b.col);
    const xs = evs.map((e) => G.colX(e.col) - 40);
    const right = G.colX(evs[evs.length - 1].col) + 40;
    xs.push(right);
    let edge = xs[0];
    evs.forEach((e, i) => {
      const em = emitOf(S, e.id);
      if (em !== null) edge += (xs[i + 1] - xs[i]) * tw(f, em + 2, 22);
    });
    const grow = tw(f, S.stallIn + li * 10, 46);
    const end = lerp(xs[0], right, grow);
    const y = G.laneY[k];
    if (end - edge < 1) return null;
    return (
      <Layer key={'st' + k} opacity={tw(f, S.stallIn, 12)}>
        <Line x1={edge} y1={y} x2={end} y2={y} color={C.slate} width={18} opacity={0.14} />
        <Line x1={edge} y1={y} x2={end} y2={y} color={C.slate} width={3} opacity={0.6} />
      </Layer>
    );
  });

  // ---------- ghosts for events that have not arrived ----------
  const ghosts = geo.map((G0) => {
    const { e, s, tx, ys, yd } = G0;
    const o = tw(f, S.ghostsIn, 18) * (1 - tw(f, s.land - 8, 8));
    if (o <= 0.002 || s.arrive <= S.ghostsIn) return null;
    return (
      <Layer key={'gh' + e.id} opacity={o}>
        <Line x1={tx} y1={ys} x2={tx} y2={yd} color={C.ink} width={2} dash={[7, 7]} cap="butt" />
        <Dot x={tx} y={ys} color={C[e.s]} num={e.sn} ghost />
        <Dot x={tx} y={yd} color={C[e.d]} num={e.dn} ghost />
      </Layer>
    );
  });

  // ---------- event bars and dots ----------
  const bars = geo.map(({ e, sx, sy, dX, dY, visible, em, p, rec }) =>
    visible ? <Line key={'bar' + e.id} x1={sx} y1={sy} x2={dX} y2={dY} color={mix(barColor(em), C.soft, rec)} width={4} opacity={clamp01(p * 3)} cap="butt" /> : null,
  );
  const dots = geo.map(({ e, sx, sy, dX, dY, visible, em, pop, settlePop, p, rec }) => {
    if (!visible) return null;
    const sc = (0.72 + 0.28 * p) * (1 + 0.22 * pop + settlePop);
    const o = clamp01(p * 4);
    // a handled transaction steps back by fading its colour toward grey (it stays opaque)
    return (
      <React.Fragment key={'dot' + e.id}>
        <Dot x={sx} y={sy} color={mix(C[e.s], '#D5D8DD', 0.75 * rec)} num={e.sn} emit={em} scale={sc} opacity={o} />
        <Dot x={dX} y={dY} color={mix(C[e.d], '#D5D8DD', 0.75 * rec)} num={e.dn} emit={em} scale={sc} opacity={o} />
      </React.Fragment>
    );
  });
  const ripples = geo.map(({ e, s, tx, ys, yd }) => {
    if (s.emit === null) return null;
    const q = (f - s.emit) / 28;
    if (q < 0 || q > 1) return null;
    const r = R + 46 * easeOut(q);
    const o = 0.6 * (1 - q);
    return (
      <React.Fragment key={'rip' + e.id}>
        <Ring x={tx} y={ys} r={r} color={C[e.s]} width={3} opacity={o} />
        <Ring x={tx} y={yd} r={r} color={C[e.d]} width={3} opacity={o} />
      </React.Fragment>
    );
  });

  // ---------- wake-up pulses ----------
  const wakes = S.wakes.map((w, i) => {
    const y = G.laneY[w.lane];
    const xa = G.colX(w.from) + R + 4;
    const xb = G.colX(w.to) - R - 4;
    const q = (f - w.t) / w.dur;
    const out: React.ReactNode[] = [];
    if (q >= 0 && q <= 1.25) {
      const head = lerp(xa, xb, smooth(Math.min(q, 1)));
      const tail = Math.max(xa, head - 110);
      const fade = q > 1 ? 1 - (q - 1) / 0.25 : 1;
      out.push(<Line key="t" x1={tail} y1={y} x2={head} y2={y} color={C[w.lane]} width={6} opacity={0.55 * fade} />);
      if (q <= 1) out.push(<Ring key="h" x={head} y={y} r={5} color={C[w.lane]} width={6} opacity={fade} />);
    }
    const q2 = (f - w.t - w.dur) / 22;
    if (q2 >= 0 && q2 <= 1) {
      const col = w.kind === 'emit' ? C[w.lane] : w.kind === 'none' ? C.ink : C.soft;
      out.push(<Ring key="p" x={G.colX(w.to)} y={y} r={R + 6 + 16 * easeOut(q2)} color={col} width={3} opacity={0.85 * (1 - q2)} />);
    }
    return out.length ? <React.Fragment key={'wk' + i}>{out}</React.Fragment> : null;
  });

  // ---------- inbox chip and verdict ----------
  const inbox = geo.map(({ e, s }) => {
    const flyT0 = s.land - FLY;
    if (f < s.arrive || f > flyT0 + 10) return null;
    const a = tw(f, s.arrive, 14);
    const pf = tw(f, flyT0, 9);
    return (
      <Chip
        key={'in' + e.id}
        x={G.inboxX}
        y={G.inboxY - 34 * (1 - a)}
        s={e.s}
        sn={e.sn}
        d={e.d}
        dn={e.dn}
        size={32}
        opacity={a}
        bgOpacity={1 - pf}
        textOpacity={1 - pf}
      />
    );
  });
  const verdicts = geo.map(({ e, s }) => {
    if (!s.verdict) return null;
    const o = window01(f, s.arrive + 14, s.land - FLY + 6, 10, 8);
    return <T key={'vd' + e.id} x={G.inboxX} y={G.verdictY} segs={s.verdict} size={24} mono opacity={o} />;
  });

  // ---------- counters ----------
  const counters = LANES.map((k) => {
    const y = G.laneY[k];
    const changes = EV.filter((e) => (e.s === k || e.d === k) && emitOf(S, e.id) !== null)
      .map((e) => (emitOf(S, e.id) as number) + 3)
      .sort((a, b) => a - b);
    const done = changes.filter((t) => t <= f);
    const v = done.length;
    const tc = done.length ? done[done.length - 1] : -1e9;
    const q = tw(f, tc, 11);
    const nodes: React.ReactNode[] = [
      <T key="l" x={G.counterX} y={y} segs={[['emitted[', C.grey], [k, C[k]], ['] =', C.grey]]} size={24} mono align="left" />,
    ];
    if (q < 1 && v > 0) {
      nodes.push(<T key="o" x={G.counterNumX} y={y - 26 * q} text={String(v - 1)} size={40} mono weight={700} align="left" opacity={1 - q} />);
      nodes.push(<T key="n" x={G.counterNumX} y={y + 26 * (1 - q)} text={String(v)} size={40} mono weight={700} align="left" opacity={q} />);
    } else {
      nodes.push(<T key="n" x={G.counterNumX} y={y} text={String(v)} size={40} mono weight={700} align="left" />);
    }
    const ck = tw(f, S.settle + 24 + LANES.indexOf(k) * 6, 14);
    nodes.push(<T key="ck" x={G.counterNumX + 52} y={y} text="✓" size={34} mono weight={700} color={C[k]} align="left" opacity={ck} />);
    return (
      <Layer key={'ct' + k} opacity={uiIn}>
        {nodes}
      </Layer>
    );
  });

  // ---------- output row ----------
  const outRow = geo.map(({ e, s, rec }) => {
    if (s.emit === null) return null;
    const a = tw(f, s.emit + 6, 14);
    if (a <= 0) return null;
    return <Chip key={'out' + e.id} x={G.colX(e.col)} y={G.outY + 16 * (1 - a)} s={e.s} sn={e.sn} d={e.d} dn={e.dn} size={20} opacity={a * (1 - 0.6 * rec)} shadow={false} />;
  });

  return (
    <Layer>
      {LANES.map((k) => (
        <Lane key={'ln' + k} k={k} y={G.laneY[k]} x0={G.x0} x1={G.x1} draw={lanesDraw} labelX={G.labelX} />
      ))}
      <T x={G.labelX} y={G.outY} text="out" size={24} weight={700} color={C.grey} opacity={uiIn} />
      <Line x1={G.x0} y1={G.outY + 34} x2={G.x1} y2={G.outY + 34} color={C.hair} width={2} opacity={uiIn} />
      {stall}
      {ghosts}
      {bars}
      {wakes}
      {dots}
      {ripples}
      {S.labels.map((l, i) => (
        <T key={'lb' + i} x={l.x} y={l.y} segs={l.segs} size={l.size ?? 22} mono={l.mono ?? true} opacity={window01(f, l.t0, l.t1, 10, 10)} />
      ))}
      {inbox}
      {verdicts}
      {counters}
      {outRow}
      {S.rules.map((r, i) => (
        <T
          key={'ru' + i}
          x={960}
          y={r.y + 8 * (1 - tw(f, r.t, 18))}
          segs={r.segs}
          size={r.size ?? 26}
          opacity={tw(f, r.t, 18) * (S.ruleFocus && S.ruleFocus[i] ? 0.35 + 0.65 * window01(f, S.ruleFocus[i].t0, S.ruleFocus[i].t1, 18, 18) : 1)}
        />
      ))}
      <Caption f={f} caps={S.captions} x={S.capX ?? 960} />
    </Layer>
  );
};

// ---------- scripts ----------
const L = (lane: LaneKey, from: number, to: number, t: number, dur: number, kind: Wake['kind']): Wake => ({ lane, from, to, t, dur, kind });

/** The main video's board scene (local frames). */
export const MAIN_SCRIPT: BoardScript = {
  lanesIn: 0,
  ev: {
    e4: { arrive: 132, land: 186, emit: 854, verdict: vPark('a', 0, 2) },
    e6: { arrive: 196, land: 244, emit: 880, verdict: vPark('a', 0, 3) },
    e2: { arrive: 254, land: 302, emit: 584, verdict: vPark('b', 0, 1) },
    e5: { arrive: 312, land: 360, emit: 862, verdict: vPark('c', 0, 2) },
    e1: { arrive: 500, land: 554, emit: 554, verdict: vEmit('a', 0, 'b', 0) },
    e3: { arrive: 778, land: 830, emit: 830, verdict: vEmit('a', 1, 'c', 1) },
  },
  ghostsIn: 372,
  stallIn: 392,
  wakes: [
    L('a', 0, 2, 566, 18, 'none'),
    L('b', 0, 1, 566, 14, 'emit'),
    L('b', 1, 3, 598, 18, 'stay'),
    L('c', 1, 2, 598, 14, 'none'),
    L('a', 2, 3, 842, 12, 'emit'),
    L('c', 2, 4, 842, 20, 'emit'),
    L('a', 3, 5, 862, 18, 'emit'),
    L('b', 3, 4, 862, 10, 'out'),
    L('c', 4, 5, 870, 12, 'out'),
  ],
  stays: [{ id: 'e4', t: 616 }],
  labels: [
    { t0: 586, t1: 650, x: G.colX(2), y: G.laneY.a - 50, segs: [['a1 has not arrived', C.ink]] },
    { t0: 614, t1: 676, x: G.colX(2), y: G.laneY.c + 50, segs: [['c1 has not arrived', C.ink]] },
    {
      t0: 618,
      t1: 760,
      x: G.colX(3) + 30,
      y: G.laneY.a - 88,
      segs: [['a2→b2 waits: ', C.grey], ['a', C.a], [' is at 1', C.grey]],
    },
    { t0: 886, t1: 990, x: G.colX(5) - 100, y: G.laneY.a - 52, segs: [['woken twice, emitted once', C.grey]] },
  ],
  captions: [
    { t0: 0, t1: 120, text: 'One counter per account: how many of its transactions are out.' },
    { t0: 122, t1: 370, text: 'A transaction that is not ready yet is parked.' },
    { t0: 372, t1: 494, text: 'Two transactions are missing, so all three accounts stall.' },
    { t0: 496, t1: 594, text: 'a0→b0 is ready: it is emitted, and a and b advance.' },
    { t0: 596, t1: 692, text: 'Each emit wakes the next slot on both accounts.' },
    { t0: 694, t1: 776, text: 'a1→c1 is still missing and holds up a, b and c.' },
    { t0: 778, t1: 860, text: 'a1→c1 arrives, and each emit wakes the next.' },
    { t0: 862, t1: 940, text: 'The parked backlog drains in one wave.' },
    { t0: 942, t1: 1040, text: 'Each account reads 0, 1, 2, 3: a topological order of the DAG.' },
  ],
  rules: [
    {
      t: 40,
      y: 140,
      size: 27,
      segs: [
        ['ready(e)', C.ink],
        ['  =  ', C.grey],
        ['emitted[src] == srcSeq', C.ink],
        ['  &&  ', C.grey],
        ['emitted[dst] == dstSeq', C.ink],
      ],
    },
    { t: 128, y: 186, size: 25, segs: [['Not ready: park it under both of its slots.', C.grey]] },
    { t: 506, y: 222, size: 25, segs: [['Ready: emit it, then wake the next slot on each account.', C.grey]] },
  ],
  settle: 900,
  // the parking line is the focus while transactions park, the emit line from a0→b0 on
  ruleFocus: [{ t0: -100, t1: 100000 }, { t0: 122, t1: 500 }, { t0: 496, t1: 100000 }],
  // once a1→c1 is the subject, the transactions already out step back until everything settles
  recede: [{ ids: ['e1', 'e2'], t0: 694, t1: 912 }],
};

/** The looping GIF: starts stalled, resolves, resets. */
export const GIF_SCRIPT: BoardScript = {
  lanesIn: -1000,
  ev: {
    e4: { arrive: -1000, land: -1000, emit: 202 },
    e6: { arrive: -1000, land: -1000, emit: 226 },
    e2: { arrive: -1000, land: -1000, emit: 86 },
    e5: { arrive: -1000, land: -1000, emit: 210 },
    e1: { arrive: 18, land: 62, emit: 62, verdict: vEmit('a', 0, 'b', 0) },
    e3: { arrive: 134, land: 180, emit: 180, verdict: vEmit('a', 1, 'c', 1) },
  },
  ghostsIn: -1000,
  stallIn: -1000,
  wakes: [
    L('a', 0, 2, 72, 14, 'none'),
    L('b', 0, 1, 72, 12, 'emit'),
    L('b', 1, 3, 96, 14, 'stay'),
    L('c', 1, 2, 96, 12, 'none'),
    L('a', 2, 3, 190, 12, 'emit'),
    L('c', 2, 4, 190, 20, 'emit'),
    L('a', 3, 5, 210, 16, 'emit'),
    L('b', 3, 4, 210, 10, 'out'),
    L('c', 4, 5, 218, 12, 'out'),
  ],
  stays: [{ id: 'e4', t: 110 }],
  labels: [
    {
      t0: 110,
      t1: 176,
      x: G.colX(3),
      y: G.laneY.a - 52,
      segs: [['a2→b2 waits: ', C.grey], ['a', C.a], [' is at 1', C.grey]],
    },
  ],
  captions: [
    { t0: -1000, t1: 130, text: 'Two transactions are missing, so all three accounts stall.' },
    { t0: 132, t1: 1000, text: 'a1→c1 arrives and the parked backlog drains in one wave.' },
  ],
  rules: [],
  settle: 232,
  capX: 1030,
};
