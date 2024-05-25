import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { App, Stack, RemovalPolicy, aws_lambda } from 'aws-cdk-lib';
import { join } from 'path'
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';


export class CdkStack extends Stack {
  constructor(app: App, id: string, props?: any) {
    super(app, id);

    let srcPath = "../go_lambda"

    // Create an S3 bucket for the static website
    const bucket = new s3.Bucket(this, 'OSortierSite', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
    });
    const eventStache = new s3.Bucket(this, 'OSortierEvents', {
      publicReadAccess: false,

    });

    // Deploy the static website to the S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployOSortier', {
      sources: [s3deploy.Source.asset('../demo_site')],
      destinationBucket: bucket,
    });


    const genLambda = new aws_lambda.Function(this, 'OSortier-GenEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'main',
      code: aws_lambda.Code.fromAsset(srcPath + '/lambda-handler.zip'),
      environment: {

      },
    }
    );
    const sortLambda = new aws_lambda.Function(this, 'OSortier-SortEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'main',
      code: aws_lambda.Code.fromAsset(srcPath + '/lambda-handler.zip'),
      environment: {

      },
    }
    );
    const getLambda = new aws_lambda.Function(this, 'OSortier-GetEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'main',
      code: aws_lambda.Code.fromAsset(srcPath + '/lambda-handler.zip'),
      environment: {

      },
    }
    );

    // Integrate the Lambda functions with the API Gateway resource
    const genInt = new LambdaIntegration(genLambda);
    const sortInt = new LambdaIntegration(sortLambda);
    const getInt = new LambdaIntegration(getLambda);
    // Create an API Gateway resource for each of the CRUD operations
    const api = new RestApi(this, 'OSortierAGW', {
      restApiName: 'OSortier'
    });

    const sort = api.root.addResource('sort');


    const genEvents = sort.addResource('/gen/{num}?session={session}');
    genEvents.addMethod('POST', genInt);
    const sortEvents = sort.addResource('/sort?session={session}');
    sortEvents.addMethod('GET', sortInt);
    const getEvents = sort.addResource('/get?session={session}');
    getEvents.addMethod('GET', getInt);

    addCorsOptions(genEvents);
    addCorsOptions(sortEvents);
    addCorsOptions(getEvents);
  }
}

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod('OPTIONS', new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    // In case you want to use binary media types, comment out the following line
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}