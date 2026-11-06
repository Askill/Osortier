import React from 'react';
import { Composition, Layer, Rect, Sequence, registerRoot, useCurrentFrame } from 'remotion';
import { Board, GIF_SCRIPT } from './board';
import { BoardScene, Closing, Fabric, Fade, OneEvent, PAUSE_BOARD, PAUSE_FABRIC, PAUSE_ONE, PAUSE_PARENTS, PAUSE_SORT, Parents, StreamSort, Title } from './scenes';
import { C, PAUSE, tw } from './lib';

const OVERLAP = 15;
const SCENES: { id: string; dur: number; C: React.FC; fin?: number; fout?: number }[] = [
  // baseline durations, plus a 1.5 s pause after each caption or text card
  { id: 'title', dur: 136 + PAUSE, C: Title, fin: 0 },
  { id: 'one-event', dur: 340 + PAUSE_ONE.extra, C: OneEvent },
  { id: 'stream-sort', dur: 622 + PAUSE_SORT.extra, C: StreamSort },
  { id: 'parents', dur: 222 + PAUSE_PARENTS.extra, C: Parents },
  { id: 'board', dur: 960 + PAUSE_BOARD.extra, C: BoardScene },
  { id: 'fabric', dur: 364 + PAUSE_FABRIC.extra, C: Fabric },
  { id: 'closing', dur: 170 + PAUSE, C: Closing, fout: 20 },
];
export const STARTS: number[] = [];
let acc = 0;
for (const s of SCENES) {
  STARTS.push(acc);
  acc += s.dur - OVERLAP;
}
const TOTAL = acc + OVERLAP;

const Main: React.FC = () => (
  <Layer>
    {SCENES.map((s, i) => (
      <Sequence key={s.id} from={STARTS[i]} durationInFrames={s.dur} layout="none">
        <Fade dur={s.dur} fin={s.fin ?? 15} fout={s.fout ?? 15}>
          <s.C />
        </Fade>
      </Sequence>
    ))}
  </Layer>
);

const GIF_LEN = 300;
const RESET = 262;
const Cascade: React.FC = () => {
  const f = useCurrentFrame();
  const q = tw(f, RESET, GIF_LEN - RESET - 2);
  return (
    <Layer>
      <Board f={Math.min(f, RESET + 4)} S={GIF_SCRIPT} />
      {q > 0 && (
        <Layer opacity={q}>
          <Rect x={-40} y={-40} width={2000} height={1160} fill={C.bg} />
          <Board f={0} S={GIF_SCRIPT} />
        </Layer>
      )}
    </Layer>
  );
};

registerRoot(() => (
  <>
    <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={30} width={1920} height={1080} background={C.bg} margin={40} />
    <Composition id="Cascade" component={Cascade} durationInFrames={GIF_LEN} fps={30} width={1920} height={1080} background={C.bg} margin={40} />
  </>
));
