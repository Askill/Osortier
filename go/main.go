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
		//fmt.Println(err)
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
		//fmt.Println("Could not save state")
		//fmt.Println(err)
	}
}

func eventHasSourcePreCondition(event Event, sequenceCounter *sequenceCounter) bool {
	////fmt.Println(event.Source_key, event.Source_sequence_number, sequenceCounter.getSequenceCounter(event.Source_key))
	return event.Source_sequence_number == sequenceCounter.getSequenceCounter(event.Source_key) || event.Source_sequence_number == 0
}

func eventHasDestPreCondition(event Event, sequenceCounter *sequenceCounter) bool {
	////fmt.Println(event.Source_key, event.Destination_sequence_number, sequenceCounter.getSequenceCounter(event.Source_key))
	return event.Destination_sequence_number == sequenceCounter.getSequenceCounter(event.Destination_key) || event.Destination_sequence_number == 0
}

func sendEvent(event Event, backlog *backlog, sequenceCounter *sequenceCounter, output *[]Event) {
	////fmt.Println("sent")
	////fmt.Println(event)
	////fmt.Println(sequenceCounter.counter)
	sc := sequenceCounter.incSequenceCounter(event.Source_key)
	dc := sequenceCounter.incSequenceCounter(event.Destination_key)
	if sc == 0 || dc == 0 {
		return
	}
	*output = append(*output, event)
	backlog.remove(event)
	//fmt.Println(event.Source_key, sequenceCounter.counter[event.Source_key])
	//fmt.Println(event.Destination_key, sequenceCounter.counter[event.Destination_key])
}

func parkOrSend(event Event, sequenceCounter *sequenceCounter, backlog *backlog, limit int, output *[]Event) {
	if limit == 0 {
		fmt.Println("recursion limit reached")
		return

	}
	sourceFullfilled := eventHasSourcePreCondition(event, sequenceCounter)
	destFullfilled := eventHasDestPreCondition(event, sequenceCounter)
	//fmt.Println(event, sourceFullfilled, destFullfilled)

	if sourceFullfilled && destFullfilled {
		sendEvent(event, backlog, sequenceCounter, output)
		limit2 := 2
		for {
			event1, err1 := backlog.get(event.Source_key, event.Source_sequence_number+1)
			if err1 != -1 {
				parkOrSend(event1, sequenceCounter, backlog, limit-1, output)
			}
			event2, err2 := backlog.get(event.Destination_key, event.Destination_sequence_number+1)
			if err2 != -1 {
				parkOrSend(event2, sequenceCounter, backlog, limit-1, output)
			}
			limit2--
			//fmt.Println("err count", err1, err2)
			if limit2 == 0 || err1+err2 == -2 {
				//fmt.Println("limit", limit2)
				break
			}
		}
	} else {
		backlog.store(event)
	}

}

func sortEvents(Events *[]Event, sequenceCounter *sequenceCounter, backlog *backlog, output *[]Event) {
	for i, event := range *Events {
		if i%10000 == 0 {
			fmt.Println(i)
		}
		parkOrSend(event, sequenceCounter, backlog, 2000000, output)
	}
}

func main() {
	fmt.Println("Generating events")
	gen()
	fmt.Println("Sorting Events")
	eventList := make([]Event, 0, 3000000)
	loadEvents(&eventList, "../data/shuffeled_events_go.json")
	fmt.Println("Loaded Events")
	sequenceCounter := &sequenceCounter{counter: make(map[string]int)}
	backlog := &backlog{counter: 1, Stored: make(map[int]Event), sources: make(map[string]int), dests: make(map[string]int)}
	output := make([]Event, 0, 3000000)

	start := time.Now()
	sortEvents(&eventList, sequenceCounter, backlog, &output)
	duration := time.Since(start)
	fmt.Println(duration)

	saveSorted(&output, "./sorted.json")
}
