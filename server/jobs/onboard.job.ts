import { DeployConfig } from '../config/deploy.config';

import { S3Service } from '../service/s3.service';
import { CloudFrontService } from '../service/cloudfront.service';
import { ApiGatewayService } from '../service/apigateway.service';

import { ACM } from "@aws-sdk/client-acm";
import { CreateDistributionCommandInput, Distribution } from '@aws-sdk/client-cloudfront';

import { Bootstrap, Injectable } from '../config/bootstrap';

import { Job } from '../../model/job.model';

@Injectable()
@Bootstrap()
export class AppOnboardJob extends Job {
    acm: ACM;

    constructor(private s3Service: S3Service, private cloudFrontService: CloudFrontService, private apiGatewayService: ApiGatewayService) {
        super('AppOnboard');

        process.env.AWS_ACCESS_KEY_ID = DeployConfig.AWS_ACCESS_KEY;
        process.env.AWS_SECRET_ACCESS_KEY = DeployConfig.AWS_ACCESS_SECRET;

        this.s3Service.init(DeployConfig.AWS_ACCESS_KEY, DeployConfig.AWS_ACCESS_SECRET);

        this.acm = new ACM({
            region: 'us-east-1'
        });
    }

    async run(_context: { data: { domain?: string, userId?: string, isDev?: boolean } }) {
         try {
            let bucket = DeployConfig.BUCKET;
            let domain = DeployConfig.DOMAIN;
            await this.s3Service.createDeploymentBucket(bucket);    

            await this.createCloudFrontDistribution(bucket, DeployConfig.CLOUDFRONT_DISTRIBUTION_NAME);

            const certificateRes = await this.cloudFrontService.requestCertificate(domain);
            console.log(certificateRes);

            this.done({ success: true });
        }
        catch(err) {
            console.log(err);
            this.done({ success: false, data: err });
        }
    }

    async createCloudFrontDistribution(bucket: string, platformName: string): Promise<{ Distribution: Distribution }> {
        console.log('creating cloudfront distribution', bucket);
        const params: CreateDistributionCommandInput = {
            DistributionConfig: { /* required */
                CallerReference: Date.now() + '', /* required */
                "Aliases": {
                    "Quantity": 0,
                    "Items": []
                },
                "Origins": {
                    "Quantity": 1,
                    "Items": [
                        {
                            "Id": `S3-${bucket}`,
                            "DomainName": `${bucket}.s3.amazonaws.com`,
                            "OriginPath": "",
                            "CustomHeaders": {
                                "Quantity": 0,
                                "Items": []
                            },
                            "S3OriginConfig": {
                                "OriginAccessIdentity": "origin-access-identity/cloudfront/EVFNLR7S70XSM"
                            }
                        }
                    ]
                },
                "OriginGroups": {
                    "Quantity": 0,
                    "Items": []
                },
                "DefaultCacheBehavior": {
                    "TargetOriginId": `S3-${bucket}`,
                    "ForwardedValues": {
                        "QueryString": true,
                        "Cookies": {
                            "Forward": "none"
                        },
                        "Headers": {
                            "Quantity": 0,
                            "Items": []
                        },
                        "QueryStringCacheKeys": {
                            "Quantity": 0,
                            "Items": []
                        }
                    },
                    "TrustedSigners": {
                        "Enabled": false,
                        "Quantity": 0,
                        "Items": []
                    },
                    "ViewerProtocolPolicy": "redirect-to-https",
                    "MinTTL": 0,
                    "AllowedMethods": {
                        "Quantity": 2,
                        "Items": [
                            "HEAD",
                            "GET"
                        ],
                        "CachedMethods": {
                            "Quantity": 2,
                            "Items": [
                                "HEAD",
                                "GET"
                            ]
                        }
                    },
                    "SmoothStreaming": false,
                    "DefaultTTL": 0,
                    "MaxTTL": 0,
                    "Compress": true,
                    /*"LambdaFunctionAssociations": {
                        "Quantity": 2,
                        "Items": [
                            {
                                "LambdaFunctionARN": "arn:aws:lambda:us-east-1:933718493275:function:custom_headers:11",
                                "EventType": "origin-response",
                                "IncludeBody": false
                            },
                            {
                                "LambdaFunctionARN": "arn:aws:lambda:us-east-1:933718493275:function:share_response:8",
                                "EventType": "origin-request",
                                "IncludeBody": false
                            }
                        ]
                    },*/
                    "FieldLevelEncryptionId": ""
                },
                "CacheBehaviors": {
                    "Quantity": 0,
                    "Items": []
                },
                "CustomErrorResponses": {
                    "Quantity": 1,
                    "Items": [
                        {
                            "ErrorCode": 403,
                            "ResponsePagePath": "/index.html",
                            "ResponseCode": "200",
                            "ErrorCachingMinTTL": 60
                        }
                    ]
                },
                "Comment": platformName,
                "PriceClass": "PriceClass_All",
                "Enabled": true,
                "ViewerCertificate": {
                    "CloudFrontDefaultCertificate": true,
                    "MinimumProtocolVersion": "TLSv1.2_2021",
                    "CertificateSource": "cloudfront"
                },
                "Restrictions": {
                    "GeoRestriction": {
                        "RestrictionType": "none",
                        "Quantity": 0,
                        "Items": []
                    }
                },
                //"WebACLId": 'arn:aws:wafv2:us-east-1:933718493275:global/webacl/Malicious-IP/0ae8a6ea-741a-48bc-90fd-a67aaf3e5dab'
            }
        };

        const res = await this.cloudFrontService.createDistribution(params);
        if (res.success) {
            return { Distribution: res.data };
        }
        else {
            throw res.data;
        }
    }

    async createApiGateway(sourceApiName: string, newApiName: string, lambdaArn: string) {
        const sourceApi = await this.apiGatewayService.getRestApiByName(sourceApiName);
        if (!sourceApi?.id) {
            throw new Error(`Source API Gateway "${sourceApiName}" not found`);
        }

        console.log(`Cloning API Gateway "${sourceApiName}" (${sourceApi.id}) -> "${newApiName}"`);
        const res = await this.apiGatewayService.cloneApi(sourceApi.id, newApiName, lambdaArn);
        if (!res.success) {
            throw new Error(`Failed to create API Gateway: ${res.msg}`);
        }

        return res.data;
    }
}