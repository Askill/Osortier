package main

type Event struct {
	Source_key                  string `json:"source_key"`
	Source_sequence_number      int    `json:"source_sequence_number"`
	Destination_key             string `json:"destination_key"`
	Destination_sequence_number int    `json:"destination_sequence_number"`
}
