package main

import (
	"context"
	"fmt"
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

	if len(result.Contents) == 0 {
		return events.APIGatewayProxyResponse{StatusCode: http.StatusNotFound}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       "{'downloadURL': '" + "https://" + bucketName + ".s3.eu-central-1.amazonaws.com/" + id + "'}",
	}, nil
}

func main() {
	// Make the handler available for Remote Procedure Call by AWS Lambda
	lambda.Start(handler)
}
