package main

import (
	"strconv"
)

type backlog struct {
	sources map[string]int
	dests   map[string]int
	Stored  map[int]Event
	counter int
}

func (bl *backlog) store(event Event) {
	bl.counter = bl.counter + 1
	bl.Stored[bl.counter] = event
	bl.sources[event.Source_key+strconv.Itoa(event.Source_sequence_number)] = bl.counter
	bl.dests[event.Destination_key+strconv.Itoa(event.Destination_sequence_number)] = bl.counter
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

func (bl *backlog) get(name1 string, count1 int, name2 string, count2 int) (Event, int) {
	source1 := bl.sources[name1+strconv.Itoa(count1)]
	dest1 := bl.dests[name1+strconv.Itoa(count1)]

	source2 := bl.sources[name2+strconv.Itoa(count2)]
	dest2 := bl.dests[name2+strconv.Itoa(count2)]

	if source1 == dest2 && source1 != 0 {
		//fmt.Println("event ret 1")
		//fmt.Println(bl.Stored[source1])
		return bl.Stored[source1], 0
	}
	if source2 == dest1 && source2 != 0 {
		//fmt.Println("event ret 2")
		//fmt.Println(bl.Stored[source2])
		return bl.Stored[source2], 0
	}
	return Event{}, -1
}

func (bl *backlog) remove(event Event) {
	id := bl.findEvent(event)
	if id != -1 {
		delete(bl.sources, event.Source_key+strconv.Itoa(event.Source_sequence_number))
		delete(bl.dests, event.Destination_key+strconv.Itoa(event.Destination_sequence_number))
		delete(bl.Stored, id)
	}
}
