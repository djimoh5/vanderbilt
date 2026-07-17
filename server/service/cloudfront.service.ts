import { DeployConfig } from '../config/deploy.config';

import { ApiResponse, BaseService } from './base.service';
import { Bootstrap, Injectable } from '../config/bootstrap';
import { AppService } from './app.service';

import { ACM, CertificateDetail, RequestCertificateCommandInput } from '@aws-sdk/client-acm';
import { CloudFront, CreateDistributionCommandInput, CreateInvalidationCommandOutput, Distribution, DistributionConfig, DistributionSummary } from '@aws-sdk/client-cloudfront';

@Injectable()
@Bootstrap()
export class CloudFrontService extends BaseService {
    private cloudfront: CloudFront;
    private acm: ACM;

    private defaultRegion = 'us-east-1';

    constructor(appService: AppService) {
        super(appService);

        this.init(DeployConfig.AWS_ACCESS_KEY, DeployConfig.AWS_ACCESS_SECRET);
    }

    init(accessKeyId: string, secretAccessKey: string) {
        const awsConfig = { credentials: { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey }, region: this.defaultRegion };
        this.cloudfront = new CloudFront(awsConfig);
        this.acm = new ACM(awsConfig);
    }

    getAllDistributions(): Promise<{ DistributionList: { Items: DistributionSummary[], IsTruncated: boolean, NextMarker?: string } }> {
        return new Promise<any>(async resolve => {
            let marker: string;
            let data: { DistributionList: { Items: DistributionSummary[] } };

            while(marker || !data) {
                const res = await this.getAllDistributionsHelper(marker);
                marker = res.DistributionList.IsTruncated ? res.DistributionList.NextMarker : null;
                console.log('marker', marker);

                if(!data) {
                    data = res;
                }
                else {
                    data.DistributionList.Items = data.DistributionList.Items.concat(res.DistributionList.Items);
                }
            }
        
            resolve(data);
        });
    }

    private getAllDistributionsHelper(marker?: string): Promise<{ DistributionList: { Items: DistributionSummary[], IsTruncated: boolean, NextMarker?: string } }> {
        return new Promise<any>((resolve, reject) => {
            this.cloudfront.listDistributions(marker ? { Marker: marker } : {}, async (err, data) => {
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    getDistribution(id: string): Promise<{ Distribution: DistributionConfig }> {
        return new Promise<any>((resolve, reject) => {
            this.cloudfront.getDistribution({ Id: id }, async (err, data) => {
                console.log(data);
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    getDistributionConfig(id: string): Promise<{ ETag: string, DistributionConfig: DistributionConfig, Id: string }> {
        return new Promise<any>((resolve, reject) => {
            this.cloudfront.getDistributionConfig({ Id: id }, async (err, data) => {
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    updateDistribution(id: string, distribution: { ETag: string, DistributionConfig: DistributionConfig, IfMatch?: string, Id: string }): Promise<{ Etag: string, DistributionConfig: DistributionConfig }> {
        distribution.Id = id;
        distribution.IfMatch = distribution.ETag;
        delete distribution.ETag;

        return new Promise<any>((resolve, reject) => {
            this.cloudfront.updateDistribution(distribution, async (err, data) => {
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    getAllCertificates(): Promise<{ CertificateSummaryList: { CertificateArn: string, DomainName: string }[], NextToken?: string }> {
        return new Promise<any>(async resolve => {
            let nextToken: string;
            let data: { CertificateSummaryList?: { CertificateArn?: string, DomainName?: string }[] };

            while(nextToken || !data) {
                const res = await this.getAllCertificatesHelper(nextToken);
                nextToken = res.NextToken;
                console.log('nextToken', nextToken);

                if(!data) {
                    data = res;
                }
                else {
                    data.CertificateSummaryList = data.CertificateSummaryList.concat(res.CertificateSummaryList);
                }
            }
        
            resolve(data);
        });
    }

    private getAllCertificatesHelper(nextToken?: string): Promise<{ CertificateSummaryList?: { CertificateArn?: string, DomainName?: string }[], NextToken?: string }> {        
        return new Promise((resolve, reject) => {
            this.acm.listCertificates(nextToken ? { NextToken: nextToken } : {}, (err, data) => {
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    getCertificateRequest(certificateArn: string): Promise<{ Certificate?: CertificateDetail }> {
        return new Promise((resolve, reject) => {
            const params = {
                CertificateArn: certificateArn /* required */
            };

            this.acm.describeCertificate(params, (err, data) => {
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    requestCertificate(domain: string): Promise<{ CertificateArn?: string }> {
        console.log('requesting certificate', domain);
        return new Promise((resolve, reject) => {
            const params: RequestCertificateCommandInput = {
                DomainName: '*.' + domain, /* required */
                ValidationMethod: 'DNS'
            };

            this.acm.requestCertificate(params, (err, data) => {
                console.log(data);
                if (err) {
                    reject(err); return;
                }

                resolve(data);
            });
        });
    }

    async invalidateCache(distributionId: string, files: string[]) {
        const params = {
            DistributionId: distributionId,
            InvalidationBatch: {
                CallerReference: Date.now() + '', //unique identity of invalidation request
                Paths: { Quantity: files.length, Items: files }
            }
        };

        const res = await this.cloudfront.createInvalidation(params).then(data => {
            return new ApiResponse(true, data);
        }).catch(err => {
            return new ApiResponse(false, err as CreateInvalidationCommandOutput);
        });

        return res;
    }

    async createDistribution(params: CreateDistributionCommandInput) {
        const res = await this.cloudfront.createDistribution(params).then(data => {
            return new ApiResponse(true, data && data.Distribution);
        }).catch(err => {
            return new ApiResponse(false, err as Distribution);
        });

        return res;
    }

    getS3BucketForDistribution(distribution: DistributionSummary) {
        return distribution.Origins.Items[0].DomainName.split('.s3')[0];
    }
}