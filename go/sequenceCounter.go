package main

type sequenceCounter struct {
	counter map[string]int
}

func (sc *sequenceCounter) getSequenceCounter(name string) int {
	val, exists := sc.counter[name]
	if !exists {
		sc.counter[name] = 0
		return 0
	}
	return val
}

func (sc *sequenceCounter) setSequenceCounter(name string, value int) {
	sc.counter[name] = value
}

func (sc *sequenceCounter) incSequenceCounter(name string) int {
	if _, exists := sc.counter[name]; !exists {
		//fmt.Println(name, "counter not found")
		sc.counter[name] = 0
		return 0
	} else {
		sc.counter[name]++ // Increment the value if the key exists
		return sc.counter[name]
	}
}
