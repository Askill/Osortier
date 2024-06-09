package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Extract the ID from the path parameters
	id := request.QueryStringParameters["session"] + "/sorted_events.json"

	bucketName := "osortiereventstore"
	// Load the Shared AWS Configuration (~/.aws/config)
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic("configuration error, " + err.Error())
	}

	// Create S3 client
	svc := s3.NewFromConfig(cfg)

	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName), // Replace with your bucket name
		Prefix: aws.String(id),
	}

	result, err := svc.ListObjectsV2(context.TODO(), input)
	if err != nil {
		return events.APIGatewayProxyResponse{StatusCode: http.StatusInternalServerError}, fmt.Errorf("error listing objects: %v", err)
	}

	var jsonData []byte
	for _, content := range result.Contents {
		object, err := svc.GetObject(context.TODO(),
			&s3.GetObjectInput{

				Bucket: aws.String(bucketName),
				Key:    content.Key,
			})
		if err != nil {
			log.Printf("failed to read object %q, %v\n", *content.Key, err)
			continue
		}

		body, err := io.ReadAll(object.Body)
		if err != nil {
			log.Printf("failed to read body, %v\n", err)
			continue
		}

		jsonData = append(jsonData, body...)
	}

	if len(jsonData) == 0 {
		return events.APIGatewayProxyResponse{StatusCode: http.StatusNotFound}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string(jsonData),
	}, nil
}

func main() {
	// Make the handler available for Remote Procedure Call by AWS Lambda
	lambda.Start(handler)
}
