package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

func eventHasSourcePreCondition(event Event, sequenceCounter *sequenceCounter) bool {
	return event.Source_sequence_number == sequenceCounter.getSequenceCounter(event.Source_key) || event.Source_sequence_number == 0
}

func eventHasDestPreCondition(event Event, sequenceCounter *sequenceCounter) bool {
	return event.Destination_sequence_number == sequenceCounter.getSequenceCounter(event.Destination_key) || event.Destination_sequence_number == 0
}

func sendEvent(event Event, backlog *backlog, sequenceCounter *sequenceCounter, output *[]Event) {

	sc := sequenceCounter.incSequenceCounter(event.Source_key)
	dc := sequenceCounter.incSequenceCounter(event.Destination_key)
	if sc == 0 || dc == 0 {
		return
	}
	*output = append(*output, event)
	backlog.remove(event)

}

func parkOrSend(event Event, sequenceCounter *sequenceCounter, backlog *backlog, limit int, output *[]Event) {
	if limit == 0 {
		fmt.Println("recursion limit reached")
		return

	}
	sourceFullfilled := eventHasSourcePreCondition(event, sequenceCounter)
	destFullfilled := eventHasDestPreCondition(event, sequenceCounter)

	if sourceFullfilled && destFullfilled {
		sendEvent(event, backlog, sequenceCounter, output)
		limit2 := 2
		for {
			event1, err1 := backlog.get(event.Source_key, event.Source_sequence_number+1)
			if err1 != -1 {
				parkOrSend(event1, sequenceCounter, backlog, limit-1, output)
			}
			event2, err2 := backlog.get(event.Destination_key, event.Destination_sequence_number+1)
			if err2 != -1 {
				parkOrSend(event2, sequenceCounter, backlog, limit-1, output)
			}
			limit2--
			if limit2 == 0 || err1+err2 == -2 {
				break
			}
		}
	} else {
		backlog.store(event)
	}

}

func sortEvents(Events *[]Event, sequenceCounter *sequenceCounter, backlog *backlog, output *[]Event) {
	for i, event := range *Events {
		if i%10000 == 0 {
			fmt.Println(i)
		}
		parkOrSend(event, sequenceCounter, backlog, 2000000, output)
	}
	for i, event := range backlog.Stored {
		if i%10000 == 0 {
			fmt.Println(i)
		}
		parkOrSend(event, sequenceCounter, backlog, 2000000, output)
	}

}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println("Sorting Events")
	// max 10 mil is set in gen
	eventList := make([]Event, 0, 100)

	getUnsorted(&eventList, request.QueryStringParameters["session"]+"/unsorted_session_data.json", "osortiereventstore")

	fmt.Println("Loaded Events")
	sequenceCounter := &sequenceCounter{counter: make(map[string]int)}
	backlog := &backlog{counter: 1, Stored: make(map[int]Event), sources: make(map[string]int), dests: make(map[string]int)}
	output := make([]Event, 0, 100)

	start := time.Now()
	sortEvents(&eventList, sequenceCounter, backlog, &output)
	duration := time.Since(start)
	fmt.Println(duration)

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
