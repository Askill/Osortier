import React from 'react';
import { Layer, Rect, linearGradient, useCurrentFrame } from 'remotion';
import { Board, EV, G, LANES, MAIN_SCRIPT, evById } from './board';
import { simulateFabric } from './fabric';
import {
  Arc,
  C,
  Cap,
  Caption,
  Chip,
  Dot,
  Lane,
  LaneKey,
  Line,
  Ring,
  T,
  barColor,
  bump,
  chipPartDx,
  clamp01,
  easeOut,
  lerp,
  makePause,
  mix,
  smooth,
  tw,
  window01,
} from './lib';

export const CAPS_ONE: Cap[] = [
  { t0: 10, t1: 104, text: 'A transaction moves stock from one account to another.' },
  { t0: 106, t1: 166, text: 'It takes the next slot on each of its two accounts.' },
  { t0: 168, t1: 262, text: 'Slots count from 0 on every account.' },
  { t0: 264, t1: 340, text: 'The producer already assigns these numbers per account.' },
];
export const CAPS_SORT: Cap[] = [
  { t0: 4, t1: 146, text: 'Transactions arrive shuffled.' },
  { t0: 148, t1: 262, text: 'Consumers need every account in order: 0, 1, 2, 3.' },
  { t0: 264, t1: 440, text: 'Why not sort by the source field?' },
  { t0: 442, t1: 560, text: 'Account a comes out fine. b and c are scrambled.' },
  { t0: 562, t1: 660, text: 'No single field orders every account: there is no global sort key.' },
];
export const CAPS_PARENTS: Cap[] = [
  { t0: 4, t1: 110, text: 'Each transaction has two parents: the previous slot on each account.' },
  { t0: 112, t1: 230, text: 'The chains form one DAG, rooted at a0→b0.' },
];
export const CAPS_FABRIC: Cap[] = [
  { t0: 4, t1: 112, text: 'With many accounts, the chains intertwine.' },
  { t0: 114, t1: 176, text: 'One early transaction is late. Everything downstream parks.' },
  { t0: 178, t1: 380, text: 'When it arrives, its whole subtree releases in one burst.' },
];
// a 1.5 s pause right after each caption has appeared; speeds are the baseline's
export const PAUSE_ONE = makePause(CAPS_ONE);
export const PAUSE_SORT = makePause(CAPS_SORT, 1.07);
export const PAUSE_PARENTS = makePause(CAPS_PARENTS, 1.06);
export const PAUSE_BOARD = makePause(MAIN_SCRIPT.captions, 1.09);
export const PAUSE_FABRIC = makePause(CAPS_FABRIC);

/** fade a scene in over its first frames and out over its last */
export const Fade: React.FC<{ dur: number; fin?: number; fout?: number; children: React.ReactNode }> = ({ dur, fin = 15, fout = 15, children }) => {
  const f = useCurrentFrame();
  const o = (fin > 0 ? tw(f, 0, fin) : 1) * (fout > 0 ? 1 - tw(f, dur - fout, fout) : 1);
  return <Layer opacity={o}>{children}</Layer>;
};

// =====================================================================
// 1. Title
// =====================================================================
export const Title: React.FC = () => {
  const f = useCurrentFrame();
  const kicker = 'Osortier';
  const l1 = tw(f, 18, 26);
  const l2 = tw(f, 32, 26);
  const sub = tw(f, 58, 24);
  return (
    <Layer>
      <T x={960} y={352} text={kicker} size={30} weight={700} color={C.a} opacity={tw(f, 6, 20)} />
      <T x={960} y={448 + 24 * (1 - l1)} text="Shuffled transactions," size={88} serif weight={700} opacity={l1} />
      <T x={960} y={562 + 24 * (1 - l2)} text="back in order" size={88} serif weight={700} opacity={l2} />
      <T x={960} y={668 + 12 * (1 - sub)} text="Event-driven systems deliver transactions out of order." size={32} serif color={C.stand} opacity={sub} />
      <T x={960} y={714 + 12 * (1 - sub)} text="Consumers that apply account state need them in sequence." size={32} serif color={C.stand} opacity={sub} />
      {LANES.map((k, i) => {
        const d = tw(f, 78 + i * 7, 34);
        const y = 800 + i * 22;
        return <Line key={k} x1={780} y1={y} x2={lerp(780, 1140, d)} y2={y} color={C[k]} width={4} opacity={0.75 * clamp01(d * 5)} />;
      })}
      {[0, 1, 2].map((i) => {
        // three tiny events on the accent lanes
        const x = 850 + i * 110;
        const pairs: [number, number][] = [
          [0, 1],
          [1, 2],
          [0, 2],
        ];
        const [p, q] = pairs[i];
        const a = tw(f, 100 + i * 8, 16);
        return (
          <Layer key={'tv' + i} opacity={a}>
            <Line x1={x} y1={800 + p * 22} x2={x} y2={800 + q * 22} color={C.ink} width={3} opacity={0.8} cap="butt" />
            <Dot x={x} y={800 + p * 22} r={7} color={C[LANES[p]]} emit={1} scale={0.6 + 0.4 * a} />
            <Dot x={x} y={800 + q * 22} r={7} color={C[LANES[q]]} emit={1} scale={0.6 + 0.4 * a} />
          </Layer>
        );
      })}
    </Layer>
  );
};

// =====================================================================
// 2. One event, two ledgers
// =====================================================================
export const OneEvent: React.FC = () => {
  const f = PAUSE_ONE.map(useCurrentFrame());
  const ya = 470;
  const yb = 660;
  const x = 960;
  const size = 58;
  const chipY = 262;
  const dx = chipPartDx(size);
  const lanes = tw(f, 8, 34);
  const chipIn = tw(f, 18, 18);
  const sp = tw(f, 74, 30); // split progress
  const morph = tw(f, 168, 18); // b2 -> b5
  const R = 34;
  const ax = lerp(x - dx, x, sp);
  const ay = lerp(chipY, ya, sp);
  const bx = lerp(x + dx, x, sp);
  const by = lerp(chipY, yb, sp);
  const ann = tw(f, 112, 18);
  const bNum = morph < 0.5 ? 2 : 5;
  const numFlip = morph < 0.5 ? 1 - morph * 2 : morph * 2 - 1;
  return (
    <Layer>
      <Caption
        f={f}
        caps={CAPS_ONE}
      />
      <Lane k="a" y={ya} x0={560} x1={1360} draw={lanes} labelX={500} />
      <Lane k="b" y={yb} x0={560} x1={1360} draw={lanes} labelX={500} />
      {/* chip background fades as the halves leave */}
      <Chip x={x} y={chipY - 30 * (1 - chipIn)} s="a" sn={2} d="b" dn={2} size={size} opacity={chipIn} bgOpacity={1 - tw(f, 72, 14)} textOpacity={f < 74 ? 1 : 0} />
      {f >= 74 && (
        <>
          <Line x1={ax} y1={ay} x2={bx} y2={by} color={C.ink} width={5} opacity={0.85 * clamp01(sp * 3)} cap="butt" />
          {/* halves: text fading into dots */}
          <T x={ax} y={ay} text="a2" size={size} mono weight={700} color={C.a} opacity={1 - clamp01(sp * 2.2)} />
          <T x={bx} y={by} text="b2" size={size} mono weight={700} color={C.b} opacity={1 - clamp01(sp * 2.2)} />
          <Dot x={ax} y={ay} r={R} color={C.a} num={2} emit={1} opacity={clamp01(sp * 2 - 0.4)} scale={0.6 + 0.4 * sp} />
          <Dot x={bx} y={by} r={R} color={C.b} num={bNum} emit={1} numOpacity={numFlip} opacity={clamp01(sp * 2 - 0.4)} scale={(0.6 + 0.4 * sp) * (1 + 0.15 * bump(f, 168, 18))} />
        </>
      )}
      {/* annotations */}
      <T x={1006} y={ya - 44} text="3rd on a" size={30} color={C.grey} align="left" opacity={ann} />
      <T x={1006} y={yb - 44} text={morph < 0.5 ? '3rd on b' : '6th on b'} size={30} color={C.grey} align="left" opacity={ann * (morph < 0.5 ? 1 - morph * 2 : morph * 2 - 1)} />
      <T
        x={906}
        y={(ya + yb) / 2}
        segs={[
          ['a2', C.a],
          ['→', C.slate],
          [morph < 0.5 ? 'b2' : 'b5', C.b],
        ]}
        size={36}
        weight={700}
        align="right"
        opacity={ann * (morph < 0.5 ? 1 - morph * 2 : morph * 2 - 1)}
      />
    </Layer>
  );
};

// =====================================================================
// 3 + 4. The shuffled stream, and why sorting fails
// =====================================================================
const ARRIVAL = ['e4', 'e6', 'e2', 'e5', 'e1', 'e3'];
const BY_SOURCE = ['e1', 'e3', 'e4', 'e6', 'e2', 'e5'];
const JIT = [
  [-1.6, 6],
  [1.2, -8],
  [-0.8, 4],
  [1.8, -5],
  [-1.3, 9],
  [0.9, -3],
];
export const StreamSort: React.FC = () => {
  const f = PAUSE_SORT.map(useCurrentFrame());
  const stackX = 222;
  const stackY = (k: number) => 296 + k * 78;
  const reorder = tw(f, 282, 46);
  const lanes = tw(f, 334, 30);
  const sortedLabel = tw(f, 280, 18);
  const goal = window01(f, 150, 268, 18, 14);

  const chips = ARRIVAL.map((id, k) => {
    const e = evById(id);
    const t0 = 18 + k * 16;
    const p = tw(f, t0, 28, easeOut);
    const k2 = BY_SOURCE.indexOf(id);
    const y0 = lerp(-80, stackY(k), p);
    const y = lerp(y0, stackY(k2), reorder);
    const arcDir = k2 > k ? 1 : k2 < k ? -1 : 0;
    const xj = JIT[k][1] * (1 - reorder);
    const x = stackX + xj + arcDir * 64 * Math.sin(Math.PI * reorder);
    const rot = lerp(lerp(arcDir * 0 + (k % 2 ? 9 : -9), JIT[k][0], p), 0, reorder);
    const dim = 1 - 0.45 * tw(f, 370 + k2 * 12, 20);
    return <Chip key={id} x={x} y={y} s={e.s} sn={e.sn} d={e.d} dn={e.dn} size={28} rotation={rot} opacity={clamp01(p * 3) * dim} />;
  });

  // dots flying from sorted chips into column k2
  const dots = BY_SOURCE.map((id, k2) => {
    const e = evById(id);
    const t0 = 362 + k2 * 12;
    const p = tw(f, t0, 26);
    if (f < t0) return null;
    const dx = chipPartDx(28);
    const tx = G.colX(k2);
    const sx = lerp(stackX - dx, tx, p);
    const sy = lerp(stackY(k2), G.laneY[e.s], p);
    const dX = lerp(stackX + dx, tx, p);
    const dY = lerp(stackY(k2), G.laneY[e.d], p);
    const o = clamp01(p * 3);
    const sc = 0.6 + 0.4 * p;
    return (
      <React.Fragment key={'d' + id}>
        <Line x1={sx} y1={sy} x2={dX} y2={dY} color={barColor(1)} width={4} opacity={o} cap="butt" />
        <Dot x={sx} y={sy} color={C[e.s]} num={e.sn} emit={1} opacity={o} scale={sc} />
        <Dot x={dX} y={dY} color={C[e.d]} num={e.dn} emit={1} opacity={o} scale={sc} />
      </React.Fragment>
    );
  });

  // highlight c1 (col 1) before c0 (col 4)
  const hl = tw(f, 500, 22);
  // readouts: the sequence each account reads, left to right
  const reads: Record<LaneKey, { seq: string; ok: boolean }> = {
    a: { seq: '0 1 2 3', ok: true },
    b: { seq: '0 2 1 3', ok: false },
    c: { seq: '1 3 0 2', ok: false },
  };
  const readouts = LANES.map((k, i) => {
    const o = tw(f, 452 + i * 16, 16);
    const r = reads[k];
    return (
      <T
        key={'r' + k}
        x={1560}
        y={G.laneY[k]}
        segs={[
          [r.seq, r.ok ? mix(C.ink, C.soft, hl) : C.red],
          [r.ok ? '  ✓' : '  ✗', r.ok ? mix(C.ink, C.soft, hl) : C.red],
        ]}
        size={34}
        weight={700}
        align="left"
        opacity={o}
      />
    );
  });

  const yc = G.laneY.c;
  return (
    <Layer>
      <Caption
        f={f}
        caps={CAPS_SORT}
      />
      <T x={stackX} y={232} text="Sorted by source" size={22} weight={700} color={C.grey} opacity={sortedLabel} />
      <T x={stackX} y={232} text="Arrival order" size={22} weight={700} color={C.grey} opacity={tw(f, 120, 18) * (1 - sortedLabel)} />
      {/* goal panel */}
      <Layer opacity={goal}>
        {LANES.map((k, i) => (
          <T
            key={'g' + k}
            x={1040}
            y={440 + i * 96}
            segs={[
              [k, C[k]],
              ['   0  1  2  3', C.ink],
            ]}
            size={54}
            weight={700}
            align="left"
            opacity={tw(f, 156 + i * 10, 18)}
          />
        ))}
      </Layer>
      {LANES.map((k) => (
        <Lane key={'ln' + k} k={k} y={G.laneY[k]} x0={G.x0} x1={G.x1} draw={lanes} labelX={G.labelX} />
      ))}
      {/* broken ledger c: red tint */}
      <Line x1={G.x0} y1={yc} x2={G.x1} y2={yc} color={C.red} width={16} opacity={0.12 * hl} />
      <Line x1={G.x0} y1={G.laneY.b} x2={G.x1} y2={G.laneY.b} color={C.red} width={16} opacity={0.07 * hl} />
      {dots}
      {chips}
      <Ring x={G.colX(1)} y={yc} r={G.R + 9} color={C.red} width={3} opacity={hl} />
      <Ring x={G.colX(4)} y={yc} r={G.R + 9} color={C.red} width={3} opacity={hl} />
      <Arc x1={G.colX(1) + 30} y1={yc + 36} x2={G.colX(4) - 30} y2={yc + 36} h={56} p={tw(f, 512, 26)} color={C.red} width={3} opacity={hl} />
      <T x={(G.colX(1) + G.colX(4)) / 2} y={yc + 106} text="c1 comes out before c0" size={24} color={C.red} opacity={tw(f, 530, 16)} />
      {readouts}
    </Layer>
  );
};

// =====================================================================
// 4b. Two parents, one DAG
// =====================================================================
export const Parents: React.FC = () => {
  const f = PAUSE_PARENTS.map(useCurrentFrame());
  const focus = tw(f, 24, 18) * (1 - tw(f, 104, 18)); // dim everything but e4 and its parents
  const R = G.R;
  // successor edges along each lane (parent -> child)
  const edges: { k: LaneKey; from: string; to: string }[] = [];
  for (const k of LANES) {
    const evs = EV.filter((e) => e.s === k || e.d === k).sort((a, b) => a.col - b.col);
    for (let i = 0; i + 1 < evs.length; i++) edges.push({ k, from: evs[i].id, to: evs[i + 1].id });
  }
  const focusSet = new Set(['e4', 'e3', 'e2']);
  const arcs = edges.map((ed, i) => {
    const a = evById(ed.from);
    const b = evById(ed.to);
    const y = G.laneY[ed.k];
    const isFocus = ed.to === 'e4';
    const t0 = isFocus ? 40 + (ed.k === 'a' ? 0 : 10) : 118 + i * 5;
    const p = tw(f, t0, 24);
    const o = isFocus ? 1 : 1 - focus;
    const span = b.col - a.col;
    return (
      <Arc
        key={'arc' + i}
        x1={G.colX(a.col) + 18}
        y1={y - 22}
        x2={G.colX(b.col) - 18}
        y2={y - 22}
        h={-26 - span * 12}
        p={p}
        color={C[ed.k]}
        width={3}
        opacity={o * 0.9}
      />
    );
  });
  const root = tw(f, 130, 18);
  return (
    <Layer>
      <Caption
        f={f}
        caps={CAPS_PARENTS}
      />
      {LANES.map((k) => (
        <Lane key={'ln' + k} k={k} y={G.laneY[k]} x0={G.x0} x1={G.x1} draw={1} labelX={G.labelX} />
      ))}
      {EV.map((e) => {
        const o = focusSet.has(e.id) ? 1 : 1 - 0.8 * focus;
        const x = G.colX(e.col);
        return (
          <Layer key={e.id} opacity={o}>
            <Line x1={x} y1={G.laneY[e.s]} x2={x} y2={G.laneY[e.d]} color={barColor(1)} width={4} cap="butt" />
            <Dot x={x} y={G.laneY[e.s]} color={C[e.s]} num={e.sn} emit={1} />
            <Dot x={x} y={G.laneY[e.d]} color={C[e.d]} num={e.dn} emit={1} />
          </Layer>
        );
      })}
      {arcs}
      <T x={G.colX(2.5)} y={G.laneY.a - 92} segs={[['parent on ', C.grey], ['a', C.a], [': a1', C.grey]]} size={22} opacity={tw(f, 60, 14) * (1 - tw(f, 104, 14))} />
      <T x={G.colX(2)} y={G.laneY.b - 106} segs={[['parent on ', C.grey], ['b', C.b], [': b1', C.grey]]} size={22} opacity={tw(f, 70, 14) * (1 - tw(f, 104, 14))} />
      <Ring x={G.colX(0)} y={G.laneY.a} r={R + 10 + 4 * bump(f, 150, 30)} color={C.ink} width={2.5} opacity={root} dash={[6, 6]} />
      <Ring x={G.colX(0)} y={G.laneY.b} r={R + 10 + 4 * bump(f, 150, 30)} color={C.ink} width={2.5} opacity={root} dash={[6, 6]} />
      <T x={G.colX(0)} y={G.laneY.c + 70} text="root: a0→b0" size={22} color={C.ink} opacity={tw(f, 140, 16)} />
      <Line x1={G.colX(0)} y1={G.laneY.b + 40} x2={G.colX(0)} y2={G.laneY.c + 44} color={C.ink} width={1.5} dash={[3, 5]} opacity={0.5 * tw(f, 140, 16)} cap="butt" />
    </Layer>
  );
};

// =====================================================================
// 5-7. The board (rule, park, stall, release, cascade)
// =====================================================================
export const BoardScene: React.FC = () => {
  // played 9% faster than the script's frame numbers, with a pause after each caption
  const f = PAUSE_BOARD.map(useCurrentFrame());
  return <Board f={f} S={MAIN_SCRIPT} />;
};

// =====================================================================
// 8. The fabric: intertwined trees that dissolve as they grow outward
// =====================================================================
const FAB = simulateFabric(34, 10, 70, 0);
// the three account colours, plus lighter and deeper tints of them for the dense strands
const FAB_COLORS = [C.a, C.b, C.c, '#3E8FC4', '#EF5B52', '#98A2AE', '#7FB5D8', '#F4948E', '#4A5563', '#00476B'];
const FAB_LETTERS = 'abcdefghij';
export const FABRIC_T = { arrive0: 30, step: 1.1, ghost: 112, drop: 160, land: 178, depthStep: 3.4 };

export const Fabric: React.FC = () => {
  const f = PAUSE_FABRIC.map(useCurrentFrame());
  const T0 = FABRIC_T;
  const N = FAB.events.length;
  const laneY = (i: number) => 240 + i * 70;
  const x0 = 170;
  const x1 = 1770;
  // the forest grows outward: columns crowd together, nodes shrink and fade
  const uOf = (col: number) => col / (N - 1);
  const colX = (col: number) => {
    const u = uOf(col);
    return 205 + 1545 * (0.75 * (1 - Math.pow(1 - u, 1.8)) + 0.25 * u);
  };
  const rOf = (col: number) => lerp(12, 3, Math.pow(uOf(col), 0.7));
  const fadeOf = (col: number) => lerp(1, 0.16, Math.pow(uOf(col), 0.9));
  const zoom = tw(f, 0, 40);
  const lanes = tw(f, 4, 34);
  const appear = (i: number) => T0.arrive0 + FAB.arriveStep[i] * T0.step;
  const emitAt = (i: number) =>
    i === FAB.late ? T0.land : FAB.burstDepth[i] >= 0 ? T0.land + FAB.burstDepth[i] * T0.depthStep : T0.arrive0 + FAB.releaseStep[i] * T0.step + 1;
  const parkedNow = FAB.events.filter((_, i) => i !== FAB.late && f >= appear(i) && f < emitAt(i)).length;
  const burstNow = FAB.events.filter((_, i) => FAB.burstDepth[i] >= 0 && f >= emitAt(i) + 2).length;

  // draw the far (small, faint) end first so the near roots sit on top
  const order = FAB.events.map((_, i) => i).sort((a, b) => FAB.events[b].col - FAB.events[a].col);
  const nodes = order.map((i) => {
    const e = FAB.events[i];
    const x = colX(e.col);
    const ys = laneY(e.s);
    const yd = laneY(e.d);
    const r = rOf(e.col);
    const isLate = i === FAB.late;
    let o = tw(f, appear(i), 8);
    let dy = 0;
    if (isLate) {
      o = tw(f, T0.drop, 10);
      dy = -140 * (1 - tw(f, T0.drop, T0.land - T0.drop, smooth));
    }
    if (o <= 0.002) return null;
    const em = tw(f, emitAt(i), 10);
    const pop = bump(f, emitAt(i), 14);
    const isRoot = e.sn === 0 && e.dn === 0;
    const handled = FAB.burstDepth[i] < 0 && i !== FAB.late ? tw(f, T0.drop, 20) : 0;
    return (
      <Layer key={'n' + i} opacity={o * fadeOf(e.col) * (1 - 0.6 * handled)}>
        <Line x1={x} y1={ys + dy} x2={x} y2={yd + dy} color={mix('#d8d8d8', '#121212', em)} width={lerp(3, 0.9, uOf(e.col))} cap="butt" />
        <Dot x={x} y={ys + dy} r={r} color={FAB_COLORS[e.s]} emit={em} scale={1 + 0.35 * pop} parkedGrey={0.65} />
        <Dot x={x} y={yd + dy} r={r} color={FAB_COLORS[e.d]} emit={em} scale={1 + 0.35 * pop} parkedGrey={0.65} />
        {isRoot && <Ring x={x} y={ys + dy} r={r + 6} color={C.ink} width={1.5} opacity={0.45} dash={[3, 4]} />}
        {isRoot && <Ring x={x} y={yd + dy} r={r + 6} color={C.ink} width={1.5} opacity={0.45} dash={[3, 4]} />}
      </Layer>
    );
  });
  const ripples = FAB.events.map((e, i) => {
    if (FAB.burstDepth[i] < 0) return null;
    const q = (f - emitAt(i)) / 30;
    if (q < 0 || q > 1) return null;
    const x = colX(e.col);
    const r = rOf(e.col);
    const rr = r + 3 * r * easeOut(q);
    const o = 0.6 * (1 - q) * fadeOf(e.col);
    return (
      <React.Fragment key={'r' + i}>
        <Ring x={x} y={laneY(e.s)} r={rr} color={FAB_COLORS[e.s]} width={2} opacity={o} />
        <Ring x={x} y={laneY(e.d)} r={rr} color={FAB_COLORS[e.d]} width={2} opacity={o} />
      </React.Fragment>
    );
  });
  const late = FAB.events[FAB.late];
  const lx = colX(late.col);
  const lr = rOf(late.col);
  const ghostO = tw(f, T0.ghost, 16) * (1 - tw(f, T0.drop, 10));
  const counterO = tw(f, 40, 16);
  const burstO = tw(f, T0.land, 12);

  return (
    <Layer>
      <Caption
        f={f}
        caps={CAPS_FABRIC}
      />
      <Layer x={960} y={555} scale={lerp(1.35, 1, zoom)} opacity={zoom}>
        <Layer x={-960} y={-555}>
          {Array.from({ length: FAB.lanes }, (_, i) => (
            <React.Fragment key={'l' + i}>
              <Rect
                x={x0}
                y={laneY(i) - 1}
                width={Math.max(1, (x1 - x0) * lanes)}
                height={2}
                fill={linearGradient(
                  [
                    [0, FAB_COLORS[i] + '60'],
                    [0.6, FAB_COLORS[i] + '28'],
                    [1, FAB_COLORS[i] + '00'],
                  ],
                  { angle: 90 },
                )}
              />
              <T x={x0 - 34} y={laneY(i)} text={FAB_LETTERS[i]} size={24} weight={700} color={FAB_COLORS[i]} opacity={lanes} />
            </React.Fragment>
          ))}
          {/* the missing root */}
          <Layer opacity={ghostO}>
            <Line x1={lx} y1={laneY(late.s)} x2={lx} y2={laneY(late.d)} color={C.ink} width={2} dash={[6, 6]} cap="butt" />
            <Dot x={lx} y={laneY(late.s)} r={lr + 2} color={C.ink} ghost />
            <Dot x={lx} y={laneY(late.d)} r={lr + 2} color={C.ink} ghost />
          </Layer>
          {nodes}
          {ripples}
        </Layer>
      </Layer>
      <T x={1760} y={160} segs={[['parked  ', C.grey], [String(parkedNow).padStart(2, ' '), C.ink]]} size={28} align="right" opacity={counterO * (1 - burstO)} />
      <T
        x={1760}
        y={160}
        segs={[['released in one burst  ', C.grey], [String(burstNow).padStart(2, ' '), C.ink], [` of ${N}`, C.grey]]}
        size={28}
        align="right"
        opacity={burstO}
      />
    </Layer>
  );
};
export const FABRIC_BURST = FAB.burstCount;

// =====================================================================
// 9. Closing card
// =====================================================================
export const Closing: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = tw(f, 14, 24);
  const l2 = tw(f, 26, 24);
  const det = tw(f, 60, 22);
  return (
    <Layer>
      {LANES.map((k, j) => {
        const d = tw(f, 4 + j * 6, 30);
        const y = 372 + j * 16;
        return <Line key={k} x1={830} y1={y} x2={lerp(830, 1090, d)} y2={y} color={C[k]} width={3} opacity={0.7 * clamp01(d * 4)} />;
      })}
      <T x={960} y={490 + 14 * (1 - l1)} text="Osortier" size={96} serif weight={700} opacity={l1} />
      <T x={960} y={590 + 14 * (1 - l2)} text="Puts transactions back in order for every account." size={44} serif weight={700} opacity={l2} />
      <T x={960} y={690 + 10 * (1 - det)} text="Stateless, single-threaded and O(n), for event-driven consumers that need in-order processing." size={30} serif color={C.stand} opacity={det} />
    </Layer>
  );
};
