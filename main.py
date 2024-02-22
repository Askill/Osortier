
from dataclasses import dataclass, field
import multiprocessing
import random
import time

import psycopg2

DB_USER = "user"
DB_PASSWD = "passwd"
DB_ADRESS = "192.168.178.33"
DB_NAME = "db"

conn = psycopg2.connect(
    host=DB_ADRESS,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWD
)
conn.autocommit = True
cursor = conn.cursor()

def setup_parked_event_table(cursor):
    cursor.execute("""
        CREATE TABLE ParkedEvents (    
        source_key varchar(255),
        source_sequence_number int,
        destination_key varchar(255),
        destination_sequence_number int,
        
        PRIMARY KEY (source_key, source_sequence_number, destination_key, destination_sequence_number)
        )
        """)
    
def delete_parked_events_table(cursor):
    cursor.execute("""
        DROP TABLE ParkedEvents""")
    
setup_parked_event_table(cursor)

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


def get_events(key_count, num):
    ret = []
    keys = [chr(97+i) for i in range(key_count)]
    event_counter = dict(zip(keys, [0]*key_count))
    for _ in range(key_count*num):
        keyA = chr(97 + random.randint(0, key_count-1))
        keyB = chr(97 + random.randint(0, key_count-1))
        while keyA == keyB:
            keyB = chr(97 + random.randint(0, key_count-1))
        event = Event(keyA, event_counter[keyA],  keyB, event_counter[keyB])
        event_counter[keyA] += 1
        event_counter[keyB] += 1
        ret.append(event)
        #print(event)
    return ret
    
def test_order(l):
    keys = []
    for event in l:
        if event.source_key not in keys:
            keys.append(event.source_key)
        if event.destination_key not in keys:
            keys.append(event.destination_key)
    partitions = dict(zip(keys, [[] for i in range(len(keys))]))

    for event in l:
        partitions[event.source_key].append(event.source_sequence_number)
        partitions[event.destination_key].append(event.destination_sequence_number)
        #print(event.source_key, event.source_sequence_number, event.destination_key, event.destination_sequence_number)

    ordered = True
    for key, value in partitions.items():
        sorted_check = value == sorted(value)
        if not sorted_check:
            ordered = False
        #print(key, sorted_check, value)
    
    return ordered
    
    
def sort_events(events):
    
    parked_events = []
    sequence_counter = {}
    outgoing_events = []
    for event in events:
        if event.source_key not in sequence_counter:
            sequence_counter[event.source_key] = -1
        if event.destination_key not in sequence_counter:
            sequence_counter[event.destination_key] = -1
        
        park_or_send(parked_events, sequence_counter, outgoing_events, event)
            
        for ev in pull_processable_events(parked_events):
            park_or_send(parked_events, sequence_counter, outgoing_events, ev)

    for ev in parked_events:
        park_or_send(parked_events, sequence_counter, outgoing_events, ev.event)            

    return outgoing_events

def pull_processable_events(parked_events):
    
    ret = []
    remove = []
    for i, event in  enumerate(parked_events):
        if event.source_key == None and event.destination_key == None:
            ret.append(event) 
            remove.append(i)
    
    for i, j in enumerate(remove):
        del parked_events[j-i]
    
    return ret

def park_or_send(parked_events, sequence_counter, outgoing_events, event):
    if event.source_key in sequence_counter.keys() and event.destination_key in sequence_counter.keys() and event.source_sequence_number == sequence_counter[event.source_key] + 1 and event.destination_sequence_number == sequence_counter[event.destination_key] + 1:
        outgoing_events.append(event)
        sequence_counter[event.source_key] += 1
        sequence_counter[event.destination_key] += 1
    elif event.source_key in sequence_counter and  event.source_sequence_number == sequence_counter[event.source_key] + 1 :
        pe = ParkedEvent(event)
        pe.source_sequence_number = None
        pe.source_key = None
        parked_events.append(pe)
    elif event.destination_key in sequence_counter and event.destination_sequence_number == sequence_counter[event.destination_key] + 1:
        pe = ParkedEvent(event)
        pe.destination_sequence_number = None
        pe.destination_key = None
        parked_events.append(pe)
    else:
        parked_events.append(ParkedEvent(event))
        
        
def sort_and_validate(pvid_count, event_count):
    events = get_events(pvid_count, event_count)
    #print(test_order(events))
    #print(events)
    random.shuffle(events)
    #print(events)
    #print(test_order(events))
    start = time.time()
    sorted_events = sort_events(events)
    #print(sorted_events)
    end = time.time()
    #print(pvid_count, event_count, end - start)
    #print(test_order(sorted_events))
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