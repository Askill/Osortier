
from dataclasses import dataclass, field
import multiprocessing
import random
import time

import db
from generate_events import get_events
from test import test_order

@dataclass
class Event:
    source_key: str
    source_sequence_number: int
    destination_key: str
    destination_sequence_number: int
    
@dataclass
class ParkedEvent:
    source_key: str = field(init=False)
    source_sequence_number: str = field(init=False)
    destination_key: str = field(init=False)
    destination_sequence_number: str = field(init=False)
    event: Event 
    
    def __post_init__(self):
        self.source_key = self.event.source_key
        self.source_sequence_number = self.event.source_sequence_number - 1
        self.destination_key = self.event.destination_key
        self.destination_sequence_number= self.event.destination_sequence_number - 1

    


def sort_and_validate(pvid_count, event_count):
    events = get_events(pvid_count, event_count)
    #print(test_order(events))
    #print(events)
    random.shuffle(events)
    #print(events)
    #print(test_order(events))
    start = time.time()
    sorted_events = db.sort_events(events)
    #print(sorted_events)
    end = time.time()
    print(pvid_count, event_count, end - start)
    print(test_order(sorted_events))
    #[print(e) for e in sorted_events]
    
def benchmark():
    params = []
    for event_count in range(10, 10000, 1000):
        for pvid_count in range(2, 100, 10):
            params.append((pvid_count, event_count))
    
    p = multiprocessing.Pool(8)
    xs = p.starmap(sort_and_validate, params)

def main():
    sort_and_validate(4, 5)


if __name__ == "__main__":
    main()
    #benchmark()