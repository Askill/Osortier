import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { App, Stack, RemovalPolicy, aws_lambda, Duration } from 'aws-cdk-lib';
import { join } from 'path'
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { BlockPublicAccess } from '@aws-cdk/aws-s3';
import { Architecture } from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';

export class CdkStack extends Stack {
  constructor(app: App, id: string, props?: any) {
    super(app, id);

    let srcPath = "../go_lambda"

    const store = new s3.Bucket(this, 'osortiereventstore', {
      versioned: false,
      bucketName: "osortiereventstore",
      publicReadAccess: true,
      blockPublicAccess: new BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: RemovalPolicy.DESTROY,

    });

    store.addLifecycleRule({
      enabled: true,
      expiration: Duration.days(1),
    });
    const site = new s3.Bucket(this, 'osortierdemosite', {
      versioned: false,
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: new BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      bucketName: "osortierdemosite",
      removalPolicy: RemovalPolicy.DESTROY
    });

    new s3deploy.BucketDeployment(this, 'DeployFiles', {
      sources: [s3deploy.Source.asset('../demo_site/osortier/dist')],
      destinationBucket: site,
    });

    const genLambda = new aws_lambda.Function(this, 'OSortier-GenEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'handler',
      code: aws_lambda.Code.fromAsset(srcPath + '/gen/lambda-handler.zip'),
      architecture: Architecture.X86_64,
      memorySize: 4096,
      timeout: Duration.seconds(29)
    }
    );
    const sortLambda = new aws_lambda.Function(this, 'OSortier-SortEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'handler',
      code: aws_lambda.Code.fromAsset(srcPath + '/sort/lambda-handler.zip'),
      architecture: Architecture.X86_64,
      memorySize: 4096,
      timeout: Duration.seconds(29)
    }
    );
    const getLambda = new aws_lambda.Function(this, 'OSortier-GetEvents', {
      runtime: aws_lambda.Runtime.PROVIDED_AL2023, // Use the provided runtime
      handler: 'handler',
      code: aws_lambda.Code.fromAsset(srcPath + '/get/lambda-handler.zip'),
      architecture: Architecture.X86_64,
      memorySize: 1024,
      timeout: Duration.seconds(29)
    }
    );

    // Integrate the Lambda functions with the API Gateway resource
    const genInt = new LambdaIntegration(genLambda, { timeout: Duration.seconds(29), });
    const sortInt = new LambdaIntegration(sortLambda, { timeout: Duration.seconds(29) });
    const getInt = new LambdaIntegration(getLambda, { timeout: Duration.seconds(29) });
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
// Add a root resource and method
const executeRole = new iam.Role(this, "role", {
  assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
  path: "/apigw-service-role/"
});
    // Define the integration with S3
    const s3Integration = new apigw.AwsIntegration({
      service: 's3',
      action: 'GetObject',
      integrationHttpMethod: "GET",
      options: {
        credentialsRole: executeRole,
        requestParameters: {
          'integration.request.header.Content-Type': "'application/octet-stream'",
          'integration.request.path.folder': 'path',
          'integration.request.path.key': 'key',
        },
        requestTemplates: {
          'application/json': '{"url": "${path}"}',
        },
      },
    });
    let root = api.root.addMethod('GET', s3Integration);
    


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