from dataclasses import dataclass, field
import psycopg2

DB_USER = "user"
DB_PASSWD = "passwd"
DB_ADRESS = "192.168.178.33"
DB_NAME = "db"

conn = psycopg2.connect(
    host=DB_ADRESS, database=DB_NAME, user=DB_USER, password=DB_PASSWD
)
conn.autocommit = True


@dataclass
class Event:
    source_key: str
    source_sequence_number: int
    destination_key: str
    destination_sequence_number: int


def clean_tables():
    cursor = conn.cursor()
    cursor.execute(
        """
        DELETE FROM OutgoingEvents WHERE 1=1;
        DELETE FROM ParkedEvents WHERE 1=1;
        DELETE FROM SequenceCounter WHERE 1=1;
        """
    )


def setup_parked_event_table():
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE ParkedEvents (    
        source_key varchar(255),
        source_sequence_number int,
        destination_key varchar(255),
        destination_sequence_number int,
        source_precondition_fullfilled bool,
        destination_precondition_fullfilled bool,

        PRIMARY KEY (source_key, source_sequence_number, destination_key, destination_sequence_number)
        )
        """
    )


def setup_outgoing_event_table():
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE OutgoingEvents (    
        source_key varchar(255),
        source_sequence_number int,
        destination_key varchar(255),
        destination_sequence_number int,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        PRIMARY KEY (source_key, source_sequence_number, destination_key, destination_sequence_number)
        )
        """
    )


def setup_sequence_counter_table():
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE SequenceCounter (    
        key varchar(255),
        sequence_number int,
        PRIMARY KEY (key)
        )
        """
    )


def delete_parked_events_table():
    cursor = conn.cursor()
    cursor.execute(
        """
        DROP TABLE ParkedEvents
        """
    )


def pull_processable_events():
    cursor = conn.cursor()
    query_string = """
    SELECT * FROM ParkedEvents WHERE source_precondition_fullfilled = true AND destination_precondition_fullfilled = true
    """
    cursor.execute(query_string)
    ret = cursor.fetchall()
    delete_pulled_processable_events()
    return ret


def delete_pulled_processable_events():
    cursor = conn.cursor()
    query_string = """
    DELETE FROM ParkedEvents WHERE source_precondition_fullfilled = true AND destination_precondition_fullfilled = true
    """
    cursor.execute(query_string)


def pull_processable_events_end():
    cursor = conn.cursor()
    query_string = """
    SELECT * FROM ParkedEvents
    """
    cursor.execute(query_string)
    ret = cursor.fetchall()
    return ret


def park_event(
    event, source_precondition_fullfilled, destination_precondition_fullfilled
):
    cursor = conn.cursor()
    query_string = f"""
    INSERT INTO ParkedEvents VALUES ('{event.source_key}', {event.source_sequence_number}, '{event.destination_key}', {event.destination_sequence_number}, {source_precondition_fullfilled}, {destination_precondition_fullfilled}) 
    """
    # print("parked", f"({pe.source_key}, {pe.source_sequence_number}, {pe.destination_key}, {pe.destination_sequence_number}, {source_precondition_fullfilled}, {destination_precondition_fullfilled})" )
    cursor.execute(query_string)


def create_sequence_counter(key):
    cursor = conn.cursor()
    query_string = f"""
    INSERT INTO SequenceCounter 
    VALUES( '{key}', 0)
    """
    cursor.execute(query_string)


def get_sequence_counter(key):
    cursor = conn.cursor()
    query_string = f"""
    SELECT COUNT(key) 
    FROM SequenceCounter 
    WHERE key = '{key}'
    """
    cursor.execute(query_string)
    value = cursor.fetchall()

    ret = value[0][0]

    return bool(ret)


def increase_sequence_counter(key, number):
    cursor = conn.cursor()
    query_string = f"""
    UPDATE SequenceCounter 
    SET sequence_number = sequence_number + 1 
    WHERE key = '{key}'
    """
    cursor.execute(query_string)


def event_has_source_precondition(event):

    if event.source_sequence_number == 0:
        return True

    cursor = conn.cursor()
    query_string = f"""
    SELECT COUNT(key) 
    FROM SequenceCounter 
    WHERE key = '{event.source_key}' 
    AND sequence_number = {event.source_sequence_number}
    """
    cursor.execute(query_string)
    ret = cursor.fetchall()[0][0]
    return bool(ret)


def event_has_dest_precondition(event):

    if event.destination_sequence_number == 0:
        return True

    cursor = conn.cursor()
    query_string = f"""
    SELECT COUNT(key) 
    FROM SequenceCounter 
    WHERE key = '{event.destination_key}' 
    AND sequence_number = {event.destination_sequence_number}
    """
    cursor.execute(query_string)
    ret = cursor.fetchall()[0][0]
    return bool(ret)

def update_precondition_status():
    cursor = conn.cursor()
    query_string = f"""
    UPDATE ParkedEvents
    SET source_precondition_fullfilled = true 
    FROM SequenceCounter
    WHERE ParkedEvents.source_key = SequenceCounter.key 
    AND ParkedEvents.source_sequence_number <= SequenceCounter.sequence_number ;
    """
    cursor.execute(query_string)
    query_string = f"""
    UPDATE ParkedEvents
    SET destination_precondition_fullfilled = true 
    FROM SequenceCounter
    WHERE ParkedEvents.destination_key = SequenceCounter.key 
    AND ParkedEvents.destination_sequence_number <= SequenceCounter.sequence_number ;
    """
    cursor.execute(query_string)

def send_event(event):
    cursor = conn.cursor()
    query_string = f"""
    INSERT INTO OutgoingEvents 
    VALUES('{event.source_key}', {event.source_sequence_number}, '{event.destination_key}', {event.destination_sequence_number}); 
  """
    cursor.execute(query_string)
    query_string = f"""
    DELETE FROM ParkedEvents 
    WHERE source_key = '{event.source_key}' 
    AND source_sequence_number = {event.source_sequence_number} 
    AND destination_key = '{event.destination_key}' 
    AND destination_sequence_number = {event.destination_sequence_number};
    """
    cursor.execute(query_string)
    increase_sequence_counter(event.source_key, event.source_sequence_number)
    increase_sequence_counter(event.destination_key, event.destination_sequence_number)
    query_string = f"""
    UPDATE ParkedEvents 
    SET source_precondition_fullfilled = true 
    WHERE 
    (source_key = '{event.source_key}' 
    AND source_sequence_number = {event.source_sequence_number+1} )
    OR
    (source_key = '{event.destination_key}' 
    AND source_sequence_number = {event.destination_sequence_number+1})
    ;
    """
    cursor.execute(query_string)
    query_string = f"""
    UPDATE ParkedEvents 
    SET destination_precondition_fullfilled = true 
    WHERE 
    (destination_key = '{event.destination_key}' 
    AND destination_sequence_number = {event.destination_sequence_number+1} )
    OR
    (destination_key = '{event.source_key}' 
    AND destination_sequence_number = {event.source_sequence_number+1});
    """
    cursor.execute(query_string)




clean_tables()
