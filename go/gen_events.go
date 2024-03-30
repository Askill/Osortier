package main

import (
	"math/rand"
	"time"
)

func get_events(account_count int, event_count int) []Event {
	events := make([]Event, 0, account_count*event_count)
	event_counter := make(map[string]int)
	for i := 0; i < account_count*event_count; i++ {
		keyA := string(97 + rand.Intn(account_count-1))
		keyB := string(97 + rand.Intn(account_count-1))
		for {
			if keyA != keyB {
				break
			}
			keyB = string(97 + rand.Intn(account_count-1))
		}
		_, exists := event_counter[keyA]
		if !exists {
			event_counter[keyA] = 0
		}
		_, exists = event_counter[keyB]
		if !exists {
			event_counter[keyB] = 0
		}
		event := Event{Source_key: keyA, Source_sequence_number: event_counter[keyA], Destination_key: keyB, Destination_sequence_number: event_counter[keyB]}
		event_counter[keyA] += 1
		event_counter[keyB] += 1
		events = append(events, event)
	}
	return events
}

func shuffle(events []Event) {
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(events), func(i, j int) { (events)[i], (events)[j] = (events)[j], (events)[i] })
}

func gen() {
	account_count := 20
	event_count := 500000

	events := get_events(account_count, event_count)
	shuffle(events)

	saveSorted(&events, "../data/shuffeled_events_go.json")
}
