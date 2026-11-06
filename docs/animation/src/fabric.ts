// Procedural "fabric": many ledgers, random cross-account events, one late root.
// The release schedule comes from running the real algorithm (counters, park
// indexed by slot, explicit wake queue), so what the animation shows is what
// the sorter would do on this input.

export type FEvent = { s: number; sn: number; d: number; dn: number; col: number };

export type FabricSim = {
  events: FEvent[];
  lanes: number;
  late: number; // index of the late event
  arrival: number[]; // arrival order (event indices), late one last
  arriveStep: number[]; // per event: step at which it arrives
  releaseStep: number[]; // per event: step at which it is emitted (pre-phase), or -1 if parked until the late event
  burstDepth: number[]; // per event: wake depth in the final burst (0 = the late event), or -1
  burstCount: number; // events released by the final burst, including the late one
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateFabric(seed: number, lanes: number, n: number, late = 0): FabricSim {
  const rnd = mulberry32(seed);
  const counters = new Array(lanes).fill(0);
  const events: FEvent[] = [];
  for (let i = 0; i < n; i++) {
    const s = Math.floor(rnd() * lanes);
    let d = Math.floor(rnd() * (lanes - 1));
    if (d >= s) d++;
    events.push({ s, sn: counters[s]++, d, dn: counters[d]++, col: i });
  }
  const others = events.map((_, i) => i).filter((i) => i !== late);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const arrival = [...others, late];

  const emitted = new Array(lanes).fill(0);
  const parked = new Map<string, number>(); // "lane:seq" -> event
  const out = new Set<number>();
  const arriveStep = new Array(n).fill(-1);
  const releaseStep = new Array(n).fill(-1);
  const burstDepth = new Array(n).fill(-1);
  const ready = (i: number) => emitted[events[i].s] === events[i].sn && emitted[events[i].d] === events[i].dn;
  const emit = (i: number) => {
    emitted[events[i].s]++;
    emitted[events[i].d]++;
    out.add(i);
    parked.delete(`${events[i].s}:${events[i].sn}`);
    parked.delete(`${events[i].d}:${events[i].dn}`);
  };
  let burstCount = 0;
  arrival.forEach((i, step) => {
    arriveStep[i] = step;
    const isLate = step === arrival.length - 1;
    if (!ready(i)) {
      parked.set(`${events[i].s}:${events[i].sn}`, i);
      parked.set(`${events[i].d}:${events[i].dn}`, i);
      return;
    }
    emit(i);
    releaseStep[i] = step;
    if (isLate) {
      burstDepth[i] = 0;
      burstCount++;
    }
    const queue: number[] = [i];
    while (queue.length) {
      const e = queue.shift()!;
      const ev = events[e];
      for (const key of [`${ev.s}:${ev.sn + 1}`, `${ev.d}:${ev.dn + 1}`]) {
        const f = parked.get(key);
        if (f !== undefined && !out.has(f) && ready(f)) {
          emit(f);
          releaseStep[f] = step;
          if (isLate) {
            burstDepth[f] = burstDepth[e] + 1;
            burstCount++;
          }
          queue.push(f);
        }
      }
    }
  });
  // In the burst, releaseStep is the last step; keep -1 for "parked until the late one" semantics.
  for (let i = 0; i < n; i++) if (burstDepth[i] >= 0) releaseStep[i] = -1;
  return { events, lanes, late, arrival, arriveStep, releaseStep, burstDepth, burstCount };
}
