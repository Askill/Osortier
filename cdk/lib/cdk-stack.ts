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
import { BlockPublicAccess } from '@aws-cdk/aws-s3';
import { Architecture } from '@aws-cdk/aws-lambda';


export class CdkStack extends Stack {
  constructor(app: App, id: string, props?: any) {
    super(app, id);

    let srcPath = "../go_lambda"

    const store = new s3.Bucket(this, 'osortiereventstore', {
      versioned: false,
      bucketName: "osortiereventstore"
    });

    const site = new s3.Bucket(this, 'osortierdemosite', {
      versioned: false,
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: new BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,/*  */
      }),
      bucketName: "osortierdemosite"
    });

    new s3deploy.BucketDeployment(this, 'DeployFiles', {
      sources: [s3deploy.Source.asset('../demo_site')],
      destinationBucket: site,
    });

    const genLambda = new aws_lambda.Function(this, 'OSortier-GenEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'handler',
      code: aws_lambda.Code.fromAsset(srcPath + '/gen/lambda-handler.zip'),
      architecture: Architecture.X86_64
    }
    );
    const sortLambda = new aws_lambda.Function(this, 'OSortier-SortEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'handler',
      code: aws_lambda.Code.fromAsset(srcPath + '/sort/lambda-handler.zip'),
      architecture: Architecture.X86_64
    }
    );
    const getLambda = new aws_lambda.Function(this, 'OSortier-GetEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'handler',
      code: aws_lambda.Code.fromAsset(srcPath + '/get/lambda-handler.zip'),
      architecture: Architecture.X86_64
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
    const events = api.root.addResource('events');
    events.addMethod('POST', genInt, {
      requestParameters:
      {
        'method.request.querystring.session': true,
        'method.request.querystring.num': true,
      },
    });
    events.addMethod('GET', getInt, {
      requestParameters:
      {
        'method.request.querystring.session': true,
        'method.request.querystring.num': true,
      },
    });
    sort.addMethod('POST', sortInt, {
      requestParameters:
      {
        'method.request.querystring.session': true,
        'method.request.querystring.num': true,
      },
    });

    addCorsOptions(sort);
    addCorsOptions(events);

    store.grantReadWrite(genLambda)
    store.grantReadWrite(getLambda)
    store.grantReadWrite(sortLambda)
    store.grantPut(genLambda)
    store.grantPut(getLambda)
    store.grantPut(sortLambda)
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