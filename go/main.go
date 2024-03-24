package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
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

func eventHasSourcePreCondition(event Event, sequenceCounter *sequenceCounter) bool {
	fmt.Println(event.Source_sequence_number, sequenceCounter.counter[event.Source_key], event.Source_key)
	return event.Source_sequence_number == sequenceCounter.counter[event.Source_key] || event.Source_sequence_number == 0
}

func eventHasDestPreCondition(event Event, sequenceCounter *sequenceCounter) bool {
	fmt.Println(event.Destination_sequence_number, sequenceCounter.counter[event.Destination_key], event.Destination_key)
	return event.Destination_sequence_number == sequenceCounter.counter[event.Destination_key] || event.Destination_sequence_number == 0
}

func sendEvent(event Event, backlog *backlog, sequenceCounter *sequenceCounter) {
	fmt.Println("sent")
	fmt.Println(event)
	sequenceCounter.incSequenceCounter(event.Source_key)
	sequenceCounter.incSequenceCounter(event.Destination_key)
	backlog.remove(event)
	fmt.Println(event.Source_key, sequenceCounter.counter[event.Source_key])
	fmt.Println(event.Destination_key, sequenceCounter.counter[event.Destination_key])
}

func parkOrSend(event Event, sequenceCounter *sequenceCounter, backlog *backlog, limit int) {
	if limit == 0 {
		return
	}
	sourceFullfilled := eventHasSourcePreCondition(event, sequenceCounter)
	destFullfilled := eventHasDestPreCondition(event, sequenceCounter)
	fmt.Println(event, sourceFullfilled, destFullfilled)
	if sourceFullfilled && destFullfilled {
		sendEvent(event, backlog, sequenceCounter)

	} else if sourceFullfilled {
		backlog.store(event)
	} else if destFullfilled {
		backlog.store(event)
	} else {
		backlog.store(event)
	}
	for {
		event1, err1 := backlog.get(event.Source_key, event.Source_sequence_number+1, event.Destination_key, event.Destination_sequence_number)
		if err1 != -1 {
			fmt.Println("retreieved 1", event1)
			parkOrSend(event1, sequenceCounter, backlog, limit-1)
		}
		event2, err2 := backlog.get(event.Source_key, event.Source_sequence_number, event.Destination_key, event.Destination_sequence_number+1)
		if err2 != -1 {
			fmt.Println("retreieved 1", event1)
			parkOrSend(event2, sequenceCounter, backlog, limit-1)
		}
		event3, err3 := backlog.get(event.Source_key, event.Source_sequence_number+1, event.Destination_key, event.Destination_sequence_number+1)
		if err3 != -1 {
			fmt.Println("retreieved 1", event1)
			parkOrSend(event3, sequenceCounter, backlog, limit-1)
		}
		limit--
		if limit == 0 || err1+err2+err3 == -3 {
			break
		}
	}
	//fmt.Println(backlog.Stored)

}

func sortEvents(Events *[]Event, sequenceCounter *sequenceCounter, backbacklog *backlog) {
	for _, event := range *Events {
		_, source_err := sequenceCounter.getSequenceCounter(event.Source_key)
		_, dest_err := sequenceCounter.getSequenceCounter(event.Destination_key)
		if source_err != 0 {
			sequenceCounter.setSequenceCounter(event.Source_key, 0)
		}
		if dest_err != 0 {
			sequenceCounter.setSequenceCounter(event.Destination_key, 0)
		}
		parkOrSend(event, sequenceCounter, backbacklog, 10)
	}
}

func main() {
	eventList := make([]Event, 1000)
	loadEvents(&eventList, "../data/events.json")
	fmt.Println("Loaded Events")
	sequenceCounter := getCounter()
	backlog := backlog{counter: 1, Stored: make(map[int]Event), sources: make(map[string]int), dests: make(map[string]int)}
	sortEvents(&eventList, &sequenceCounter, &backlog)
}
