import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { App, Stack, RemovalPolicy, aws_lambda, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { Architecture } from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

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
      restApiName: 'OSortier',
      binaryMediaTypes: ["*/*"],
      minimumCompressionSize: 0,
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
    const executeRole = new iam.Role(this, "api-gateway-s3-assume-tole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      roleName: "API-Gateway-S3-Integration-Role",
    });
    executeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:Get'],
      resources: [`${site.bucketArn}/*`],
    }));
    // Define the integration with S3
    const indexPageIntegration = new apigw.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${site.bucketName}/index.html`,
      options: {
        credentialsRole: executeRole,
        passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
        integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Content-Type": "integration.response.header.Content-Type",
            "method.response.header.Timestamp":  "integration.response.header.Date"
          },
        },
      ]},
    });

    // Configure the integration response
    const methodOptions: apigw.MethodOptions = { methodResponses: [
      { statusCode: '200', responseParameters:   {"method.response.header.Content-Type": true,  "method.response.header.Timestamp": true}},
      { statusCode: '400' },
      { statusCode: '500' }
    ]};
    // we add a GET method to the root resource. 
    api.root.addMethod("GET", indexPageIntegration, methodOptions);
    addCorsOptions(api.root);
    const assetsIntegration = new apigw.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${site.bucketName}/assets/{path}`,
      options: {
        credentialsRole: executeRole,
        passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_MATCH,
        requestParameters: {
          "integration.request.path.path": "method.request.path.path"
        },
        integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Content-Type": "integration.response.header.Content-Type",
            "method.response.header.Timestamp": "integration.response.header.Date"
          },
        },
      ]},
    });
    const assets = api.root.addResource("assets").addResource("{path}");
    addCorsOptions(assets)
    assets.addMethod("GET", assetsIntegration, {...methodOptions, requestParameters: {"method.request.path.path": true}});
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