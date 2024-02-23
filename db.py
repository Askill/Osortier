
from dataclasses import dataclass, field
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

def clean_tables():
    cursor = conn.cursor()
    cursor.execute(
        """
        DELETE FROM OutgoingEvents WHERE 1=1;
        DELETE FROM ParkedEvents WHERE 1=1;
        DELETE FROM SequenceCounter WHERE 1=1;
        """)

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
        """)
    
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
        """)
def setup_sequence_counter_table():
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE SequenceCounter (    
        key varchar(255),
        sequence_number int,
        PRIMARY KEY (key)
        )
        """)
def delete_parked_events_table():
    cursor = conn.cursor()
    cursor.execute(
        """
        DROP TABLE ParkedEvents
        """)
    

def pull_processable_events():
    cursor = conn.cursor()
    query_string = """
    SELECT * FROM ParkedEvents WHERE source_key = 'Null' AND destination_key = 'Null' 
    """
    cursor.execute(query_string)
    return cursor.fetchall()

def park_event(event, source_precondition_fullfilled, destination_precondition_fullfilled):
    pe = ParkedEvent(event)
    if source_precondition_fullfilled:
        pe.source_sequence_number = None
        pe.source_key = None
    elif destination_precondition_fullfilled:
        pe.destination_sequence_number = None
        pe.destination_key = None
    cursor = conn.cursor()
    query_string = f"""
    INSERT INTO ParkedEvents VALUES ({pe.source_key}, {pe.source_sequence_number}, {pe.destination_key}, {pe.destination_sequence_number}, {source_precondition_fullfilled}, {destination_precondition_fullfilled}) 
    """
    cursor.execute(query_string)

def create_sequence_counter(key):
    cursor = conn.cursor()
    query_string = f"""
    INSERT INTO SequenceCounter VALUES( '{key}', 0)
    """
    cursor.execute(query_string)

def get_sequence_counter(key):
    cursor = conn.cursor()
    query_string = f"""
    SELECT * FROM SequenceCounter WHERE SequenceCounter.key = '{key}'
    """
    cursor.execute(query_string)
    return cursor.fetchall()

def increase_sequence_counter(key):
    cursor = conn.cursor()
    query_string = f"""
    UPDATE SequenceCounter SET sequence_number = sequence_number + 1 WHERE key = '{key}'
    """
    cursor.execute(query_string)

def event_has_source_precondition(event):
    cursor = conn.cursor()
    query_string = f"""
    SELECT COUNT(key) FROM SequenceCounter WHERE key = '{event.source_key}' AND sequence_number = {event.source_sequence_number - 1}
    """
    cursor.execute(query_string)
    return bool(cursor.fetchall())

def event_has_dest_precondition(event):
    cursor = conn.cursor()
    query_string = f"""
    SELECT COUNT(key) FROM SequenceCounter WHERE key = '{event.destination_key}' AND sequence_number = {event.destination_sequence_number - 1}
    """
    cursor.execute(query_string)
    return bool(cursor.fetchall())

def send_event(event):
    cursor = conn.cursor()
    query_string = f"""
    INSERT INTO OutgoingEvents VALUES('{event.source_key}', {event.source_sequence_number}, '{event.destination_key}', {event.destination_sequence_number}) 
    """
    cursor.execute(query_string)
    increase_sequence_counter(event.source_key)
    increase_sequence_counter(event.destination_key)

def park_or_send(event):
    source_fullfilled = event_has_source_precondition(event)
    dest_fullfilled = event_has_dest_precondition(event)

    if source_fullfilled and dest_fullfilled:
        send_event(event)
    elif source_fullfilled:
        park_event(event, True, False)
    elif dest_fullfilled:
        park_event(event, False, True)
    else:
        park_event(event, False, False)

def sort_events(events):
    for event in events:
        source_count = get_sequence_counter(event.source_key)
        dest_count = get_sequence_counter(event.destination_key)
        
        if not source_count:
            create_sequence_counter(event.source_key)
        if not dest_count:
            create_sequence_counter(event.destination_key)
        
        park_or_send(event) 

        # make this parrallel
        for ev in pull_processable_events():
            park_or_send(ev)

    for ev in pull_processable_events():
        park_or_send(ev.event)            

    cursor = conn.cursor()
    query_string = """
    SELECT * FROM OutgoingEvents ORDER BY created_at ASC
    """
    cursor.execute(query_string)
    values = cursor.fetchall()
    return [Event(a,b,c,d) for a,b,c,d,_ in values] 


#setup_outgoing_event_table()
#setup_sequence_counter_table()
#setup_parked_event_table()
clean_tables()