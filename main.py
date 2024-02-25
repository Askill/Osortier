
import multiprocessing
import time

import db
from generate_events import get_events
from test import test_order


def park_or_send(event):
    source_fullfilled = db.event_has_source_precondition(event)
    dest_fullfilled = db.event_has_dest_precondition(event)

    if source_fullfilled and dest_fullfilled:
        db.send_event(event)
    elif source_fullfilled:
        db.park_event(event, True, False)
    elif dest_fullfilled:
        db.park_event(event, False, True)
    else:
        db.park_event(event, False, False)

def sort_events(events):
    
    for event in events:
        source_count = db.get_sequence_counter(event.source_key)
        dest_count = db.get_sequence_counter(event.destination_key)
        
        if not source_count:
            db.create_sequence_counter(event.source_key)
        if not dest_count:
            db.create_sequence_counter(event.destination_key)
        
        park_or_send(event) 
        # make this parrallel
        while True:
            ev = db.pull_processable_events()
            if not ev:
                break
            for x in ev:
                park_or_send(db.Event(*x[:4]))
    

    cursor = db.conn.cursor()
    query_string = """
    SELECT * FROM OutgoingEvents ORDER BY created_at ASC
    """
    cursor.execute(query_string)
    values = cursor.fetchall()
    return [db.Event(a,b,c,d) for a,b,c,d,_ in values] 

def sort_and_validate(events):
    #print(test_order(events))
    #print(events)
    #shuffle(events)

    #print(events)
    #print(test_order(events))
    start = time.time()
    sorted_events = sort_events(events)
    #print(sorted_events)
    end = time.time()
    print(end - start, "s")
    print("ordered: ", test_order(sorted_events), "length ", len(sorted_events) )
    #print("events: ")
    #[print(e) for e in sorted_events]


def main():
    events = get_events(100, 100)
    sort_and_validate(events)





def benchmark():
    params = []
    for event_count in range(10, 10000, 1000):
        for pvid_count in range(2, 100, 10):
            params.append((pvid_count, event_count))
    
    p = multiprocessing.Pool(8)
    xs = p.starmap(sort_and_validate, params)

if __name__ == "__main__":
    main()
    #benchmark()