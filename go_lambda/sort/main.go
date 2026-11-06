package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func upload(events *[]Event, bucketName string, objectKey string) {
	jsonData, _ := json.Marshal(events)
	// Load the Shared AWS Configuration (~/.aws/config)
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic("configuration error, " + err.Error())
	}

	// Create S3 client
	svc := s3.NewFromConfig(cfg)

	// Convert the JSON data to bytes
	buf := new(bytes.Buffer)
	buf.Write(jsonData)

	// Upload the JSON data to S3
	_, err = svc.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
		Body:   buf,
	})
	if err != nil {
		fmt.Println("failed to upload file:", err)
		return
	}
}

func getUnsorted(Events *[]Event, id string, bucketName string) {

	// Load the Shared AWS Configuration (~/.aws/config)
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic("configuration error, " + err.Error())
	}

	fmt.Println("before new config")
	// Create S3 client
	svc := s3.NewFromConfig(cfg)
	fmt.Println("after new config")
	inputObj := &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(id),
	}
	fmt.Println("before getObj")
	object, err := svc.GetObject(context.TODO(), inputObj)
	fmt.Println("after new config")
	if err != nil {
		fmt.Println("failed to read object\n", id, bucketName)

	}

	jsonData := new(bytes.Buffer)
	jsonData.ReadFrom(object.Body)
	if err != nil {
		fmt.Println("failed to read body, ", err)

	}

	json.Unmarshal(jsonData.Next(1000000000000000), &Events)
}

// eventIsReady is strict: a slot must equal its chain counter exactly. The old
// "seq == 0" exception was redundant for consistent data and dangerous for
// inconsistent data: a duplicate genesis event passed it twice, double-advanced
// the counter, and stalled the whole real chain behind it.
func eventIsReady(event Event, sc *sequenceCounter) bool {
	return event.Source_sequence_number == sc.getSequenceCounter(event.Source_key) &&
		event.Destination_sequence_number == sc.getSequenceCounter(event.Destination_key)
}

// emitEvent advances both counters, records the event, and frees its slots.
// Both counters are sure to be materialized (the ready check read them), so
// neither increment can fail; the old sc==0 guard was unreachable.
func emitEvent(event Event, bl *backlog, sc *sequenceCounter, output *[]Event) {
	sc.incSequenceCounter(event.Source_key)
	sc.incSequenceCounter(event.Destination_key)
	*output = append(*output, event)
	bl.remove(event)
}

// runQueue works wake-up requests to exhaustion. A request carries the event
// just emitted; each chain's successor is looked up and emitted only if ready.
// A not-ready follower stays parked exactly as it is: no re-store. So a
// follower woken twice (once per predecessor) can never be re-parked as a
// zombie after its own emission, and a follower whose sibling subtree runs
// between the two wake-ups is caught by the second request. This replaces the
// old inline recursion with the limit2 refetch: no depth cap, nothing dropped.
func runQueue(pending *[]Event, sc *sequenceCounter, bl *backlog, output *[]Event) {
	for len(*pending) > 0 {
		emitted := (*pending)[0]
		*pending = (*pending)[1:]
		if f, err := bl.get(emitted.Source_key, emitted.Source_sequence_number+1); err != -1 && eventIsReady(f, sc) {
			emitEvent(f, bl, sc, output)
			*pending = append(*pending, f)
		}
		if f, err := bl.get(emitted.Destination_key, emitted.Destination_sequence_number+1); err != -1 && eventIsReady(f, sc) {
			emitEvent(f, bl, sc, output)
			*pending = append(*pending, f)
		}
	}
}

// sortEvents walks the input once. A ready input event emits immediately and
// its cascade runs to exhaustion; a not-ready one parks. The queue holds
// requests, never raw events, so no event can re-park after emission.
func sortEvents(Events *[]Event, sc *sequenceCounter, bl *backlog, output *[]Event) {
	pending := make([]Event, 0, 16)

	for i, event := range *Events {
		if i%10000 == 0 {
			fmt.Println(i)
		}
		if eventIsReady(event, sc) {
			emitEvent(event, bl, sc, output)
			pending = append(pending[:0], event)
			runQueue(&pending, sc, bl, output)
		} else {
			bl.store(event)
		}
	}

	// Second pass over parked events, kept from the deployed build. On
	// consistent data it is a no-op (differential test in go/sorter_test.go).
	for _, event := range bl.Stored {
		if eventIsReady(event, sc) {
			pending = append(pending[:0], event)
			runQueue(&pending, sc, bl, output)
		}
	}
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println("Sorting Events")
	// max 10 mil is set in gen
	eventCount, _ := strconv.Atoi(request.QueryStringParameters["num"])
	eventList := make([]Event, 0, eventCount)

	getUnsorted(&eventList, request.QueryStringParameters["session"]+"/unsorted_session_data.json", "osortiereventstore")

	fmt.Println("Loaded Events")
	sequenceCounter := &sequenceCounter{counter: make(map[string]int)}
	backlog := &backlog{counter: 1, Stored: make(map[int]Event), sources: make(map[string]int), dests: make(map[string]int)}
	output := make([]Event, 0, eventCount)

	start := time.Now()
	sortEvents(&eventList, sequenceCounter, backlog, &output)
	duration := time.Since(start)
	fmt.Println(duration)

	fmt.Printf("emitted %d, parked %d, slot conflicts %d\n", len(output), len(backlog.Stored), backlog.conflicts)

	upload(&output, "osortiereventstore", request.QueryStringParameters["session"]+"/sorted_events.json")

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string("done"),
	}, nil
}
func main() {
	// Make the handler available for Remote Procedure Call by AWS Lambda
	lambda.Start(handler)
}
