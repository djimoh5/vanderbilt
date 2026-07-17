import { Job } from '../../model/job.model';

import { S3Service } from '../service/s3.service';
import { CloudFrontService } from '../service/cloudfront.service';
import { DeleteObjectsRequest, ListObjectsV2Request, _Object } from '@aws-sdk/client-s3';

import { Bootstrap, Injectable } from '../config/bootstrap';
import { DeployConfig } from '../config/deploy.config';
import { Common } from '../../utility/common';
import { GenericMap } from '../../model/shared.model';

var fs = require('fs');

@Injectable()
@Bootstrap()
export class UIDeployJob extends Job {
    envMap: GenericMap<string> = {
        'sprint': '.sprint',
        'qa': '.qa',
        'demo': '.demo',
        'staging': '.staging',
        'release': '.release'
    };

    excludedFiles = [
        'favicon.ico'
    ];

    ignoreAssets = true;

    constructor(private s3Service: S3Service, private cloudFrontService: CloudFrontService) {
        super('UIDeploy');

        this.s3Service.init(DeployConfig.AWS_ACCESS_KEY, DeployConfig.AWS_ACCESS_SECRET);
    }

    async run(_context: {}) {
        await this.deployBucket(DeployConfig.BUCKET);
        this.done({ success: true });
    }

    async deployBucket(bucket: string) {
        console.log('--------------------', bucket, '--------------------');

        //try to upload one file first to make sure build did not fail
        await this.uploadFile('./ui/dist/ui/browser/index.html', 'index.html', bucket);

        await this.deleteFiles(bucket);

        await this.uploadFiles('./ui/dist/ui/browser/', bucket);

        await this.oneTimeDeploy(bucket);

        try {
            await this.invalidateCloudFrontCache(DeployConfig.CLOUDFRONT_DISTRIBUTION);
        } catch (_ex) {
            await this.invalidateCloudFrontCache(DeployConfig.CLOUDFRONT_DISTRIBUTION);
        }
    }

    private async oneTimeDeploy(_bucket: string) {
        await this.uploadFile('./ui/dist/ui/browser/favicon.ico', 'favicon.ico', _bucket);
    }

    private async deleteFiles(bucket: string, continuationToken?: string) {
        return new Promise(resolve => {
            var params: ListObjectsV2Request = { Bucket: bucket, MaxKeys: 100 }; //100 is the highest allowed
            if (continuationToken) {
                params.ContinuationToken = continuationToken;
            }

            this.s3Service.s3.listObjectsV2(params, async (err, data) => {
                if (err) {
                    //this.errorService.logError(`S3 - List Objects Failed: ${bucket}/`, err, ErrorType.Handled, this.auditUserId, { params });
                    throw (err);
                }

                var params: DeleteObjectsRequest = {
                    Bucket: bucket,
                    Delete: { Objects: [] }
                };

                for (var i = 0, s3Obj: _Object; s3Obj = data.Contents[i]; i++) {
                    if ((!this.ignoreAssets || s3Obj.Key.substring(0, 7) !== 'assets/') && this.excludedFiles.indexOf(s3Obj.Key) < 0) {
                        params.Delete.Objects.push({ Key: s3Obj.Key });
                    }
                }

                if (params.Delete.Objects.length > 0) {
                    this.s3Service.s3.deleteObjects(params, err => {
                        if (err) {
                            //this.errorService.logError(`S3 - Delete Failed: ${bucket}/`, err, ErrorType.Handled, this.auditUserId, { params });
                            throw (err);
                        }

                        console.log('Deleted', params.Delete.Objects.length, 'files');

                        this.nextDeleteFiles(bucket, data, resolve);
                    });
                }
                else {
                    this.nextDeleteFiles(bucket, data, resolve);
                }
            });
        });
    }

    private async nextDeleteFiles(bucket: any, data: any, resolve: any) {
        if (data.NextContinuationToken) {
            await this.deleteFiles(bucket, data.NextContinuationToken);
        }

        resolve();
    }

    private async uploadFiles(dir: string, bucket: string) {
        return new Promise<void>(resolve => {
            var files = fs.readdirSync(dir);
            var cnt = files.length;
            var num = 0;

            files.forEach(async (file: any) => {
                if (file.indexOf('.') >= 0 && this.excludedFiles.indexOf(file) < 0) {
                    num++;
                    await this.uploadFile(dir + file, file, bucket);

                    if (--cnt === 0) {
                        console.log('Uploaded', num, 'files');
                        resolve();
                    }
                }
                else if (--cnt === 0) {
                    resolve();
                }
            });
        });
    }

    private async uploadFile(sourceFilePath: string, destinationKey: string, bucket: string) {
        return new Promise<void>(resolve => {
            let body = fs.createReadStream(sourceFilePath);//.pipe(zlib.createGzip());

            this.s3Service.s3.putObject({
                Bucket: bucket,
                Key: destinationKey,
                Body: body,
                ContentType: Common.getContentTypeFromName(sourceFilePath),
                ACL: 'public-read'
            }, err => {
                if (err) {
                    //this.errorService.logError(`S3 - Put Failed: ${bucket}/${destinationKey}`, err, ErrorType.Handled, this.auditUserId, { bucket, destinationKey });
                    throw (err);
                }

                resolve();
            });
        });
    }

    private async invalidateCloudFrontCache(distributionId: string) {
        const files = ['/', '/index.html', '/favicon.ico'];

        const res = await this.cloudFrontService.invalidateCache(distributionId, files);

        if (!res.success) {
            const err = res.data;
            console.log(err);
            //this.errorService.logError('Unable to invalidate CloudFront', err, ErrorType.Handled, this.auditUserId, { distributionId });
        }
        else {
            console.log('CloudFront index.html invalidated', distributionId, res.data.Location);
        }

        return res.data;
    }
}