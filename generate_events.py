from dataclasses import dataclass, field
import json
import multiprocessing
import random
import time


@dataclass
class Event:
    source_key: str
    source_sequence_number: int
    destination_key: str
    destination_sequence_number: int

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


def shuffle(events, shuffle_score=1):
    if shuffle_score == 1:
        random.shuffle(events)
    else:
        step_size = shuffle_score * len(events)
        for i in range(0, len(events)-5, int(step_size)):
            y = events[i:i+2]
            random.shuffle(y)
            events[i:i+5] = y

    return events

def save_json(data, path):
    with open(path, 'w') as f:
        json.dump(data, f, default=lambda x: x.__dict__)

def main():
    account_count= 10
    event_count= 100

    events = get_events(account_count, event_count)
    shuffeled = shuffle(get_events(account_count, event_count), 0.2)

    save_json(events, "./data/events.json")
    save_json(shuffeled, "./data/shuffeled_events.json")

main()