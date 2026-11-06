package main

import (
	"strconv"
)

type backlog struct {
	sources map[string]int
	dests   map[string]int
	Stored  map[int]Event
	counter int

	// Slot conflicts: a second, different event claiming a position already
	// held by a parked event. First claim wins, the loser is counted, never
	// indexed over.
	conflicts      int
	conflictEvents []Event
}

func (bl *backlog) store(event Event) bool {
	if id := bl.findEvent(event); id != -1 {
		return false // already parked (same event, or its reversal)
	}
	srcSlot := event.Source_key + strconv.Itoa(event.Source_sequence_number)
	dstSlot := event.Destination_key + strconv.Itoa(event.Destination_sequence_number)

	// A position (key, seq) belongs to exactly one event. If any of the four
	// slots it claims is already indexed by a different parked event, this is
	// inconsistent input. Refuse instead of overwriting: rejecting keeps the
	// first claimant reachable and records the conflicting event.
	if bl.sources[srcSlot] != 0 || bl.dests[srcSlot] != 0 || bl.sources[dstSlot] != 0 || bl.dests[dstSlot] != 0 {
		bl.conflicts++
		bl.conflictEvents = append(bl.conflictEvents, event)
		return false
	}

	bl.counter = bl.counter + 1
	bl.Stored[bl.counter] = event
	bl.sources[srcSlot] = bl.counter
	bl.dests[dstSlot] = bl.counter
	return true
}

func (bl *backlog) findEvent(event Event) int {
	source1 := bl.sources[event.Source_key+strconv.Itoa(event.Source_sequence_number)]
	dest1 := bl.dests[event.Source_key+strconv.Itoa(event.Source_sequence_number)]

	source2 := bl.sources[event.Destination_key+strconv.Itoa(event.Destination_sequence_number)]
	dest2 := bl.dests[event.Destination_key+strconv.Itoa(event.Destination_sequence_number)]

	if source1 == dest2 && source1 != 0 {
		return source1
	}
	if source2 == dest1 && source2 != 0 {
		return source2
	}
	return -1
}

func keysFromMap(mymap map[string]int) []string {
	keys := make([]string, 0, len(mymap))
	for k := range mymap {
		keys = append(keys, k)
	}
	return keys
}

func (bl *backlog) get(name1 string, count1 int) (Event, int) {
	source1, exists1 := bl.sources[name1+strconv.Itoa(count1)]
	dest1, exists2 := bl.dests[name1+strconv.Itoa(count1)]

	if exists1 {
		return bl.Stored[source1], 0
	} else if exists2 {
		return bl.Stored[dest1], 0
	} else {
		return Event{}, -1
	}
}

func (bl *backlog) remove(event Event) {
	id := bl.findEvent(event)
	if id != -1 {
		delete(bl.sources, event.Source_key+strconv.Itoa(event.Source_sequence_number))
		delete(bl.dests, event.Destination_key+strconv.Itoa(event.Destination_sequence_number))
		delete(bl.Stored, id)
	}
}
