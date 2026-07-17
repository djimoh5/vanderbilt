import { DeployConfig } from '../config/deploy.config';
import { ApiResponse, BaseService } from './base.service';
import { Bootstrap, Injectable } from '../config/bootstrap';
import { AppService } from './app.service';

import {
    APIGateway,
    Resource,
    RestApi,
    Stage,
    Method
} from '@aws-sdk/client-api-gateway';

export interface ApiGatewayConfig {
    api: RestApi;
    resources: Resource[];
    stages: Stage[];
}

@Injectable()
@Bootstrap()
export class ApiGatewayService extends BaseService {
    private gateway: APIGateway;
    private region = 'us-east-1';

    constructor(appService: AppService) {
        super(appService);
        this.init(DeployConfig.AWS_ACCESS_KEY, DeployConfig.AWS_ACCESS_SECRET);
    }

    init(accessKeyId: string, secretAccessKey: string) {
        this.gateway = new APIGateway({
            credentials: { accessKeyId, secretAccessKey },
            region: this.region
        });
    }

    async getRestApiByName(name: string): Promise<RestApi | null> {
        const res = await this.gateway.getRestApis({ limit: 500 });
        return res.items?.find(api => api.name === name) ?? null;
    }

    // Pulls the full config from an existing API Gateway (resources with embedded methods, stages).
    // Use this to inspect the source API before cloning.
    async getApiConfig(apiId: string): Promise<ApiGatewayConfig> {
        const [api, resourcesRes, stagesRes] = await Promise.all([
            this.gateway.getRestApi({ restApiId: apiId }),
            this.gateway.getResources({ restApiId: apiId, limit: 500, embed: ['methods'] }),
            this.gateway.getStages({ restApiId: apiId })
        ]);

        return {
            api,
            resources: resourcesRes.items ?? [],
            stages: stagesRes.item ?? []
        };
    }

    // Creates a new API Gateway that mirrors the source API's structure, replacing the Lambda ARN.
    async cloneApi(sourceApiId: string, newApiName: string, newLambdaArn: string): Promise<ApiResponse<{ api: RestApi; invokeUrl: string }>> {
        try {
            const { api: sourceApi, resources, stages } = await this.getApiConfig(sourceApiId);

            const newApi = await this.gateway.createRestApi({
                name: newApiName,
                description: sourceApi.description,
                endpointConfiguration: sourceApi.endpointConfiguration,
                binaryMediaTypes: sourceApi.binaryMediaTypes
            });

            const rootResourcesRes = await this.gateway.getResources({ restApiId: newApi.id });
            const newRootResource = rootResourcesRes.items?.find(r => r.path === '/');

            // Map source path -> new resource id, seeded with root
            const pathToNewId = new Map<string, string>();
            pathToNewId.set('/', newRootResource.id);

            // Process resources shallowest-first so parents exist before children
            const sorted = [...resources].sort((a, b) =>
                (a.path?.split('/').length ?? 0) - (b.path?.split('/').length ?? 0)
            );

            for (const resource of sorted) {
                if (resource.path === '/') continue;

                const pathParts = resource.path.split('/');
                const parentPath = pathParts.slice(0, -1).join('/') || '/';
                const parentId = pathToNewId.get(parentPath);

                const newResource = await this.gateway.createResource({
                    restApiId: newApi.id,
                    parentId,
                    pathPart: resource.pathPart
                });

                pathToNewId.set(resource.path, newResource.id);
            }

            // Recreate methods on every resource (including root)
            for (const resource of sorted) {
                const newResourceId = resource.path === '/' ? newRootResource.id : pathToNewId.get(resource.path);
                if (resource.resourceMethods) {
                    for (const [httpMethod, method] of Object.entries(resource.resourceMethods)) {
                        await this.cloneMethod(newApi.id, newResourceId, httpMethod, method, newLambdaArn);
                    }
                }
            }

            for (const stage of stages) {
                await this.gateway.createDeployment({
                    restApiId: newApi.id,
                    stageName: stage.stageName,
                    stageDescription: stage.description,
                    variables: stage.variables
                });
            }

            const primaryStage = stages[0]?.stageName ?? 'prod';
            const invokeUrl = `https://${newApi.id}.execute-api.${this.region}.amazonaws.com/${primaryStage}`;

            return new ApiResponse(true, { api: newApi, invokeUrl });
        } catch (err) {
            console.log('cloneApi error', err);
            return new ApiResponse(false, null, (err as Error).message);
        }
    }

    private async cloneMethod(apiId: string, resourceId: string, httpMethod: string, method: Method, newLambdaArn: string) {
        await this.gateway.putMethod({
            restApiId: apiId,
            resourceId,
            httpMethod,
            authorizationType: method.authorizationType ?? 'NONE',
            apiKeyRequired: method.apiKeyRequired,
            requestParameters: method.requestParameters
        });

        const integration = method.methodIntegration;
        if (integration) {
            let uri = integration.uri;
            if (uri) {
                // Replace Lambda ARN in: arn:aws:apigateway:{region}:lambda:path/2015-03-31/functions/{arn}/invocations
                uri = uri.replace(/functions\/[^/]+\/invocations/, `functions/${newLambdaArn}/invocations`);
            }

            await this.gateway.putIntegration({
                restApiId: apiId,
                resourceId,
                httpMethod,
                type: integration.type,
                integrationHttpMethod: integration.httpMethod,
                uri,
                credentials: integration.credentials,
                requestParameters: integration.requestParameters,
                requestTemplates: integration.requestTemplates,
                passthroughBehavior: integration.passthroughBehavior,
                contentHandling: integration.contentHandling,
                timeoutInMillis: integration.timeoutInMillis
            });

        }

        // methodResponses must exist before integrationResponses can reference them
        if (method.methodResponses) {
            for (const [statusCode, methodResponse] of Object.entries(method.methodResponses)) {
                await this.gateway.putMethodResponse({
                    restApiId: apiId,
                    resourceId,
                    httpMethod,
                    statusCode,
                    responseParameters: methodResponse.responseParameters,
                    responseModels: methodResponse.responseModels
                });
            }
        }

        if (integration?.integrationResponses) {
            for (const [statusCode, intResponse] of Object.entries(integration.integrationResponses)) {
                await this.gateway.putIntegrationResponse({
                    restApiId: apiId,
                    resourceId,
                    httpMethod,
                    statusCode,
                    selectionPattern: intResponse.selectionPattern,
                    responseParameters: intResponse.responseParameters,
                    responseTemplates: intResponse.responseTemplates,
                    contentHandling: intResponse.contentHandling
                });
            }
        }
    }
}
