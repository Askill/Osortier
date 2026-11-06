package main

import (
	"fmt"
	"math/rand"
	"testing"
)

// Test conventions: construct concrete input data, run the sorter, watch the
// output. The reference implementation below is a faithful copy of the
// ORIGINAL algorithm (loose "seq == 0" predicate, eager recursion with the
// inline wake recheck) used for differential testing on consistent data.

func refParkOrSend(event Event, sc *sequenceCounter, bl *backlog, limit int, output *[]Event) {
	if limit == 0 {
		return
	}
	srcReady := event.Source_sequence_number == sc.getSequenceCounter(event.Source_key) || event.Source_sequence_number == 0
	dstReady := event.Destination_sequence_number == sc.getSequenceCounter(event.Destination_key) || event.Destination_sequence_number == 0
	if srcReady && dstReady {
		scx := sc.incSequenceCounter(event.Source_key)
		dcx := sc.incSequenceCounter(event.Destination_key)
		if scx == 0 || dcx == 0 {
			return
		}
		*output = append(*output, event)
		bl.remove(event)
		limit2 := 2
		for {
			e1, err1 := bl.get(event.Source_key, event.Source_sequence_number+1)
			if err1 != -1 {
				refParkOrSend(e1, sc, bl, limit-1, output)
			}
			e2, err2 := bl.get(event.Destination_key, event.Destination_sequence_number+1)
			if err2 != -1 {
				refParkOrSend(e2, sc, bl, limit-1, output)
			}
			limit2--
			if limit2 == 0 || err1+err2 == -2 {
				break
			}
		}
	} else {
		bl.store(event)
	}
}

// refRecursiveSort creates fresh state and runs the reference algorithm.
func refRecursiveSort(events []Event, drain bool) ([]Event, *backlog, *sequenceCounter) {
	sc := &sequenceCounter{counter: map[string]int{}}
	bl := &backlog{counter: 1, Stored: map[int]Event{}, sources: map[string]int{}, dests: map[string]int{}}
	out := []Event{}
	runRef(events, sc, bl, drain, &out)
	return out, bl, sc
}

// runRef feeds events through the reference implementation into an EXISTING
// state, so replay scenarios can drive the same counters again.
func runRef(events []Event, sc *sequenceCounter, bl *backlog, drain bool, out *[]Event) {
	for _, e := range events {
		refParkOrSend(e, sc, bl, 2000000, out)
	}
	if drain {
		for _, e := range bl.Stored {
			refParkOrSend(e, sc, bl, 2000000, out)
		}
	}
}

func freshSort() (*sequenceCounter, *backlog) {
	return &sequenceCounter{counter: map[string]int{}},
		&backlog{counter: 1, Stored: map[int]Event{}, sources: map[string]int{}, dests: map[string]int{}}
}

// makeConsistent builds a complete, conflict-free world: each event links two
// different keys and claims one previously-unused position per key.
func makeConsistent(r *rand.Rand, keyCount, n int) []Event {
	keys := make([]string, keyCount)
	for i := range keys {
		keys[i] = string(rune('A' + i))
	}
	c := map[string]int{}
	out := make([]Event, 0, n)
	for i := 0; i < n; i++ {
		a := keys[r.Intn(keyCount)]
		b := keys[r.Intn(keyCount)]
		for b == a {
			b = keys[r.Intn(keyCount)]
		}
		out = append(out, Event{Source_key: a, Source_sequence_number: c[a], Destination_key: b, Destination_sequence_number: c[b]})
		c[a]++
		c[b]++
	}
	r.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

// perKeyOrders records, per key, the sequence numbers in emission order. Any
// valid topological order agrees per key, so this is the right comparison.
func perKeyOrders(out []Event) map[string][]int {
	o := map[string][]int{}
	for _, e := range out {
		o[e.Source_key] = append(o[e.Source_key], e.Source_sequence_number)
		o[e.Destination_key] = append(o[e.Destination_key], e.Destination_sequence_number)
	}
	return o
}

func perKeyOrdersString(out []Event) string {
	return fmt.Sprintf("%v", perKeyOrders(out))
}

// assertCausal replays an emitted sequence exactly as the sorter must: both
// slots of every emitted event must equal their chain counter at that moment.
func assertCausal(t *testing.T, name string, out []Event) {
	t.Helper()
	counters := map[string]int{}
	for _, e := range out {
		if counters[e.Source_key] != e.Source_sequence_number {
			t.Fatalf("%s: %s.%d emitted out of chain order, counter(%s)=%d", name, e.Source_key, e.Source_sequence_number, e.Source_key, counters[e.Source_key])
		}
		if counters[e.Destination_key] != e.Destination_sequence_number {
			t.Fatalf("%s: destination %s.%d emitted out of chain order, counter(%s)=%d", name, e.Destination_key, e.Destination_sequence_number, e.Destination_key, counters[e.Destination_key])
		}
		counters[e.Source_key]++
		counters[e.Destination_key]++
	}
}

func TestOldDuplicateGenesisPoisonsChainNewOneDoesNot(t *testing.T) {
	poisoned := []Event{
		{Source_key: "B", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 1},
		{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0}, // first claim of A.0/B.0
		{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0}, // duplicate re-arrival
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
	}

	refOut, refBl, _ := refRecursiveSort(poisoned, false)
	if len(refOut) != 2 || refOut[0] != refOut[1] {
		t.Fatalf("reference behavior changed: expected the duplicate position 0 emitted twice, got %v", refOut)
	}
	if len(refBl.Stored) != 2 {
		t.Fatalf("reference: expected the real chain stall (2 parked), got %d", len(refBl.Stored))
	}
	t.Logf("old algorithm output: %v", refOut)
	t.Logf("old algorithm per-key A order: %v", perKeyOrders(refOut)["A"])
	aSeq := perKeyOrders(refOut)["A"]
	if len(aSeq) != 2 || aSeq[0] != 0 || aSeq[1] != 0 {
		t.Fatalf("expected chain A order corrupted to [0 0], got %v", aSeq)
	}

	sc, bl := freshSort()
	world := append([]Event(nil), poisoned...)
	var out []Event
	sortEvents(&world, sc, bl, &out)

	if len(out) != 3 {
		t.Fatalf("fixed: expected 3 events emitted (first claim of each position wins), got %d: %v", len(out), out)
	}
	if out[0] != (Event{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0}) {
		t.Fatalf("fixed: first arrival should win the A.0 claim, got %v", out[0])
	}
	if len(bl.Stored) != 1 {
		t.Fatalf("fixed: expected the late duplicate parked, got %d parked", len(bl.Stored))
	}
	assertCausal(t, "fixed", out)
	t.Logf("fixed output: %v (1 parked copy: the late duplicate)", out)
}

func TestSlotConflictIsRejectedNotOverwritten(t *testing.T) {
	bl := &backlog{counter: 1, Stored: map[int]Event{}, sources: map[string]int{}, dests: map[string]int{}}

	first := Event{Source_key: "A", Source_sequence_number: 5, Destination_key: "Z", Destination_sequence_number: 0}
	second := Event{Source_key: "A", Source_sequence_number: 5, Destination_key: "W", Destination_sequence_number: 0}
	cross := Event{Source_key: "Q", Source_sequence_number: 3, Destination_key: "A", Destination_sequence_number: 5}

	if !bl.store(first) {
		t.Fatal("first claimant must park")
	}
	if bl.store(second) {
		t.Fatal("second claim on the same source slot A.5 must be rejected")
	}
	if bl.store(cross) {
		t.Fatal("destination-side claim on the occupied slot A.5 must be rejected")
	}
	if bl.store(first) {
		t.Fatal("exact duplicate of a parked event must be rejected as duplicate")
	}
	if bl.conflicts != 2 {
		t.Fatalf("expected 2 conflicts counted (second, cross), got %d", bl.conflicts)
	}
	e, err := bl.get("A", 5)
	if err != 0 || e != first {
		t.Fatalf("slot A.5 must still resolve to the first claimant, got %v err %d", e, err)
	}
}

func TestDeepChainWorklist(t *testing.T) {
	const n = 100000
	r := rand.New(rand.NewSource(7))
	world := make([]Event, 0, n)
	for i := 0; i < n; i++ {
		world = append(world, Event{Source_key: "A", Source_sequence_number: i, Destination_key: fmt.Sprintf("k%d", i), Destination_sequence_number: 0})
	}
	r.Shuffle(len(world), func(i, j int) { world[i], world[j] = world[j], world[i] })

	sc, bl := freshSort()
	var out []Event
	sortEvents(&world, sc, bl, &out)

	if len(out) != n {
		t.Fatalf("expected all %d events emitted despite worst-case parking, got %d", n, len(out))
	}
	assertCausal(t, "deep chain", out)
	if len(bl.Stored) != 0 {
		t.Fatalf("nothing should remain parked, got %d", len(bl.Stored))
	}
}

func TestFuzzRecursiveVsWorklist(t *testing.T) {
	for seed := 1; seed <= 200; seed++ {
		r := rand.New(rand.NewSource(int64(seed)))
		keyCount := 2 + r.Intn(7)
		n := 5 + r.Intn(76)
		world := makeConsistent(r, keyCount, n)

		refOut, _, _ := refRecursiveSort(world, false)

		sc, bl := freshSort()
		var out []Event
		sortEvents(&world, sc, bl, &out)

		if len(out) != n || len(bl.Stored) != 0 {
			t.Fatalf("seed %d: out %d/%d, parked %d", seed, len(out), n, len(bl.Stored))
		}
		refOrders := perKeyOrdersString(refOut)
		newOrders := perKeyOrdersString(out)
		if refOrders != newOrders {
			t.Fatalf("seed %d: per-key chain order diverged:\nrecursive: %s\nworklist:  %s", seed, refOrders, newOrders)
		}
		assertCausal(t, fmt.Sprintf("seed %d", seed), out)
		assertCausal(t, fmt.Sprintf("reference seed %d", seed), refOut)
	}
}

func TestFuzzDrainIsNoOp(t *testing.T) {
	for seed := 1000; seed <= 1100; seed++ {
		r := rand.New(rand.NewSource(int64(seed)))
		world := makeConsistent(r, 2+r.Intn(7), 5+r.Intn(76))

		outNoDrain, _, _ := refRecursiveSort(world, false)
		outDrain, _, _ := refRecursiveSort(world, true)

		if perKeyOrdersString(outNoDrain) != perKeyOrdersString(outDrain) {
			t.Fatalf("seed %d: drain changed the output:\nno drain: %s\ndrain:    %s", seed, perKeyOrdersString(outNoDrain), perKeyOrdersString(outDrain))
		}
	}
}

func TestDemonstrationEmittedOrder(t *testing.T) {
	world := []Event{
		{Source_key: "C", Source_sequence_number: 2, Destination_key: "E", Destination_sequence_number: 0},
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
		{Source_key: "E", Source_sequence_number: 2, Destination_key: "D", Destination_sequence_number: 1},
		{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0},
		{Source_key: "D", Source_sequence_number: 0, Destination_key: "E", Destination_sequence_number: 1},
		{Source_key: "B", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 1},
	}
	sc, bl := freshSort()
	input := append([]Event(nil), world...)
	var out []Event
	sortEvents(&input, sc, bl, &out)

	expected := []Event{
		{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0},
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
		{Source_key: "B", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 1},
		{Source_key: "C", Source_sequence_number: 2, Destination_key: "E", Destination_sequence_number: 0},
		{Source_key: "D", Source_sequence_number: 0, Destination_key: "E", Destination_sequence_number: 1},
		{Source_key: "E", Source_sequence_number: 2, Destination_key: "D", Destination_sequence_number: 1},
	}
	for i, e := range expected {
		if out[i] != e {
			t.Fatalf("emission %d: expected %v, got %v", i, e, out[i])
		}
	}
	assertCausal(t, "demonstration", out)
	t.Logf("input : %v", world)
	t.Logf("output: %v", out)
}

func TestReplayAfterCompleteRun(t *testing.T) {
	// A Kafka-style replay: the whole batch redelivered into a state that has
	// already processed it. This world has exactly one double-genesis event
	// (A.0,B.0), which is what gen produces for the first event of two keys.
	world := []Event{
		{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0},
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
		{Source_key: "B", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 1},
		{Source_key: "C", Source_sequence_number: 2, Destination_key: "E", Destination_sequence_number: 0},
		{Source_key: "D", Source_sequence_number: 0, Destination_key: "E", Destination_sequence_number: 1},
		{Source_key: "E", Source_sequence_number: 2, Destination_key: "D", Destination_sequence_number: 1},
	}
	doubleZero := 1

	// new engine: three replays into the same state must emit nothing
	sc, bl := freshSort()
	var out1, out2 []Event
	base := append([]Event(nil), world...)
	sortEvents(&base, sc, bl, &out1)
	if len(out1) != 6 {
		t.Fatalf("new: base run incomplete: %d/6", len(out1))
	}
	assertCausal(t, "new base", out1)
	for i := 1; i <= 3; i++ {
		replay := append([]Event(nil), world...)
		sortEvents(&replay, sc, bl, &out2)
		if len(out2) != 0 {
			t.Fatalf("new: replay %d re-emitted %v", i, out2)
		}
	}
	if len(bl.Stored) != 6 || bl.conflicts != 0 {
		t.Fatalf("new: expected one reported copy per event and no conflicts, got parked=%d conflicts=%d", len(bl.Stored), bl.conflicts)
	}
	t.Logf("new: 3 replays re-emitted nothing; all 6 copies parked and counted")

	// old algorithm: every replay re-emits the double-genesis event and
	// inflates the counters again
	refOut, refBl, refSC := refRecursiveSort(world, false)
	if len(refOut) != 6 {
		t.Fatalf("reference: base run incomplete: %d/6", len(refOut))
	}
	baseA := refSC.getSequenceCounter("A")
	aInvolved := 0
	for _, e := range world {
		if (e.Source_key == "A" || e.Destination_key == "A") && e.Source_sequence_number == 0 && e.Destination_sequence_number == 0 {
			aInvolved++
		}
	}
	for i := 1; i <= 3; i++ {
		replay := append([]Event(nil), world...)
		runRef(replay, refSC, refBl, false, &refOut)
		if got := len(refOut) - 6; got != doubleZero*i {
			t.Fatalf("old: replay %d grew the output by %d events, expected %d (double-genesis re-emission)", i, got, doubleZero*i)
		}
	}
	wantA := baseA + 3*aInvolved
	if got := refSC.getSequenceCounter("A"); got != wantA {
		t.Fatalf("old: counter(A) inflated to %d, expected %d (base %d + one bump per replay)", got, wantA, baseA)
	}
	aOrders := perKeyOrders(refOut)["A"]
	if len(aOrders) != 5 || aOrders[0] != 0 || aOrders[1] != 1 || aOrders[2] != 0 || aOrders[3] != 0 || aOrders[4] != 0 {
		t.Fatalf("old: chain A order corrupted by replays, got %v", aOrders)
	}
	if got := len(refBl.Stored); got != 6-doubleZero {
		t.Fatalf("old: expected %d zombie copies parked, got %d", 6-doubleZero, got)
	}
	t.Logf("old: counter(A) %d -> %d, chain A order %v", baseA, refSC.getSequenceCounter("A"), aOrders)
}

func TestLateGenesisArrivesLast(t *testing.T) {
	// Gap-fill replay: the missed event is caught up at the end of the stream.
	// Both versions must flush the whole parked backlog; no duplicates involved.
	world := []Event{
		{Source_key: "B", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 1},
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
		{Source_key: "A", Source_sequence_number: 0, Destination_key: "B", Destination_sequence_number: 0},
	}
	sc, bl := freshSort()
	worldRun := append([]Event(nil), world...)
	var out []Event
	sortEvents(&worldRun, sc, bl, &out)
	if len(out) != 3 || len(bl.Stored) != 0 {
		t.Fatalf("new: late genesis must flush the backlog, out=%v parked=%d", out, len(bl.Stored))
	}
	assertCausal(t, "new catch-up", out)

	refOut, _, _ := refRecursiveSort(world, false)
	if perKeyOrdersString(refOut) != perKeyOrdersString(out) {
		t.Fatalf("old and new must agree on duplicate-free catch-up:\nold: %s\nnew: %s", perKeyOrdersString(refOut), perKeyOrdersString(out))
	}
	t.Logf("catch-up output: %v", out)
}

func TestRedeliveryOfParkedEventIsDeduplicated(t *testing.T) {
	// At-least-once redelivery of an event that is still parked (no offset
	// commit yet): both versions must keep exactly one parked copy.
	world := []Event{
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
		{Source_key: "A", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 0},
		{Source_key: "B", Source_sequence_number: 1, Destination_key: "C", Destination_sequence_number: 1},
	}
	sc, bl := freshSort()
	worldRun := append([]Event(nil), world...)
	var out []Event
	sortEvents(&worldRun, sc, bl, &out)
	if len(out) != 0 {
		t.Fatalf("new: nothing can emit without the genesis events, got %v", out)
	}
	if len(bl.Stored) != 2 || bl.conflicts != 0 {
		t.Fatalf("new: redelivery must dedupe, got parked=%d conflicts=%d", len(bl.Stored), bl.conflicts)
	}
	refOut, refBl, _ := refRecursiveSort(world, false)
	if len(refOut) != 0 || len(refBl.Stored) != 2 {
		t.Fatalf("old: expected the same dedupe, got out=%v parked=%d", refOut, len(refBl.Stored))
	}
}
