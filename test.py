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
    for _, value in partitions.items():
        sorted_check = value == sorted(value)
        if not sorted_check:
            ordered = False
        #print(key, sorted_check, value)
    return ordered