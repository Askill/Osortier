package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"
)

func loadEvents(Events *[]Event, path string) {
	stateJSON, err := os.Open(path)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer stateJSON.Close()
	byteValue, _ := io.ReadAll(stateJSON)

	json.Unmarshal(byteValue, &Events)
}

func saveSorted(events *[]Event, path string) {
	JSON, _ := json.Marshal(events)
	file, err := os.Create(path)

	if err != nil {
		return
	}
	defer file.Close()
	file.WriteString(string(JSON))
	if err != nil {
		fmt.Println("Could not save state")
		fmt.Println(err)
	}
}

// eventIsReady is strict: a slot must equal its chain counter exactly. The old
// "seq == 0" exception was redundant for consistent data (a counter starts at
// 0, so position 0 passes the equality) and dangerous for inconsistent data:
// a duplicate genesis event passed it twice, double-advanced the counter, and
// stalled the whole real chain behind it.
func eventIsReady(event Event, sc *sequenceCounter) bool {
	return event.Source_sequence_number == sc.getSequenceCounter(event.Source_key) &&
		event.Destination_sequence_number == sc.getSequenceCounter(event.Destination_key)
}

// emitEvent advances both counters, records the event, and frees its slots.
// Both counters are sure to be materialized (the ready check read them), so
// neither increment can fail; the old sc==0 guard was unreachable.
func emitEvent(event Event, bl *backlog, sc *sequenceCounter, output *[]Event) {
	sc.incSequenceCounter(event.Source_key)
	sc.incSequenceCounter(event.Destination_key)
	*output = append(*output, event)
	bl.remove(event)
}

// runQueue works wake-up requests to exhaustion. A request carries the event
// just emitted; each chain's successor is looked up and emitted only if ready.
// A not-ready follower stays parked exactly as it is: no re-store. So a
// follower woken twice (once per predecessor) can never be re-parked as a
// zombie after its own emission, and a follower whose sibling subtree runs
// between the two wake-ups is caught by the second request. This replaces the
// old inline recursion with the limit2 refetch: no depth cap, nothing dropped.
func runQueue(pending *[]Event, sc *sequenceCounter, bl *backlog, output *[]Event) {
	for len(*pending) > 0 {
		emitted := (*pending)[0]
		*pending = (*pending)[1:]
		if f, err := bl.get(emitted.Source_key, emitted.Source_sequence_number+1); err != -1 && eventIsReady(f, sc) {
			emitEvent(f, bl, sc, output)
			*pending = append(*pending, f)
		}
		if f, err := bl.get(emitted.Destination_key, emitted.Destination_sequence_number+1); err != -1 && eventIsReady(f, sc) {
			emitEvent(f, bl, sc, output)
			*pending = append(*pending, f)
		}
	}
}

// sortEvents walks the input once. A ready input event emits immediately and
// its cascade runs to exhaustion; a not-ready one parks. The queue holds
// requests, never raw events, so no event can re-park after emission.
func sortEvents(Events *[]Event, sc *sequenceCounter, bl *backlog, output *[]Event) {
	pending := make([]Event, 0, 16)

	for i, event := range *Events {
		if i%10000 == 0 {
			fmt.Println(i)
		}
		if eventIsReady(event, sc) {
			emitEvent(event, bl, sc, output)
			pending = append(pending[:0], event)
			runQueue(&pending, sc, bl, output)
		} else {
			bl.store(event)
		}
	}

	// Second pass over parked events, kept from the lambda build. On
	// consistent data it is a no-op (differential test in sorter_test.go); it
	// is kept as a cheap safety net and as parity with the deployed build.
	for _, event := range bl.Stored {
		if eventIsReady(event, sc) {
			pending = append(pending[:0], event)
			runQueue(&pending, sc, bl, output)
		}
	}
}

func main() {
	fmt.Println("Generating events")
	gen(30, 100000)

	fmt.Println("Sorting Events")
	eventList := make([]Event, 0, 3000000)
	loadEvents(&eventList, "../data/shuffeled_events_go.json")

	fmt.Println("Loaded Events")
	sequenceCounter := &sequenceCounter{counter: make(map[string]int)}
	backlog := &backlog{counter: 1, Stored: make(map[int]Event), sources: make(map[string]int), dests: make(map[string]int)}
	output := make([]Event, 0, 3000000)

	start := time.Now()
	sortEvents(&eventList, sequenceCounter, backlog, &output)
	fmt.Println(time.Since(start))

	fmt.Printf("emitted %d, parked %d, slot conflicts %d\n", len(output), len(backlog.Stored), backlog.conflicts)

	saveSorted(&output, "./sorted.json")
}
