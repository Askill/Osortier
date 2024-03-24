package main

type sequenceCounter struct {
	counter map[string]int
}

func getCounter() sequenceCounter {
	return sequenceCounter{counter: make(map[string]int)}
}

func (sc *sequenceCounter) getSequenceCounter(name string) (int, int) {
	return sc.counter[name], 1
}

func (sc *sequenceCounter) setSequenceCounter(name string, value int) {
	sc.counter[name] = value
}

func (sc *sequenceCounter) incSequenceCounter(name string) {
	sc.counter[name] = sc.counter[name] + 1
}
