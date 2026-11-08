package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func upload(bucketName string, objectKey string, jsonData []byte) {

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

func get_events(account_count int, event_count int) []Event {
	events := make([]Event, 0, account_count*event_count)
	event_counter := make(map[string]int)
	for i := 0; i < account_count*event_count; i++ {
		keyA := string(97 + rand.Intn(account_count-1))
		keyB := string(97 + rand.Intn(account_count-1))
		for {
			if keyA != keyB {
				break
			}
			keyB = string(97 + rand.Intn(account_count-1))
		}
		_, exists := event_counter[keyA]
		if !exists {
			event_counter[keyA] = 0
		}
		_, exists = event_counter[keyB]
		if !exists {
			event_counter[keyB] = 0
		}
		event := Event{Source_key: keyA, Source_sequence_number: event_counter[keyA], Destination_key: keyB, Destination_sequence_number: event_counter[keyB]}
		event_counter[keyA] += 1
		event_counter[keyB] += 1
		events = append(events, event)
	}
	return events
}

func shuffle(events []Event) {
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(events), func(i, j int) { (events)[i], (events)[j] = (events)[j], (events)[i] })
}

func gen(account_count int, event_count int) []Event {
	events := get_events(account_count, event_count)
	shuffle(events)
	return events
}

type Resp struct {
	Body string
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println(request.QueryStringParameters)
	i, _ := strconv.Atoi(request.QueryStringParameters["num"])
	eventss := gen(10, min(i, 10000000)/10)
	barray, _ := json.Marshal(eventss)
	upload("osortiereventstore", request.QueryStringParameters["session"]+"/unsorted_session_data.json", barray)
	resp := Resp{
		Body: fmt.Sprintf("%s request  is successful!", request.Body),
	}
	msg, _ := json.Marshal(resp)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       string(msg),
	}, nil
}

func main() {
	// Make the handler available for Remote Procedure Call by AWS Lambda
	lambda.Start(handler)
}
