import { Config } from '../config/config';
import { S3UploadInfo, RawDocument } from '../../model/s3.model';

import { Common } from '../../utility/common';
import { BaseService, ApiResponse, ApiErrorResponse } from './base.service';
import { Bootstrap, Injectable } from '../config/bootstrap';
import { AppService } from './app.service';
//import { HttpService } from './http.service';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateBucketCommandInput, GetObjectCommand, GetObjectCommandInput, PutObjectCommand, PutObjectCommandInput, S3 } from '@aws-sdk/client-s3';
//import { ErrorsUtility } from '../utility/errors.utility';
import { Readable } from 'stream';
import { UnicodeCharactersSimpleRegex } from '../../model/html-special-characters';

@Injectable()
@Bootstrap()
export class S3Service extends BaseService {
    s3: S3;
    private defaultRegion = 'us-east-1';

    constructor(appService: AppService/*, private http: HttpService*/) {
        super(appService);

        this.init(Config.AWS_ACCESS_KEY, Config.AWS_ACCESS_SECRET);
    }

    init(accessKeyId: string, secretAccessKey: string) {
        this.s3 = new S3({
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },

            region: this.defaultRegion,
        });
    }

    getUploadInfo(bucketName: string, directory: string, origFileName: string, fileType: string, isPublic: boolean): Promise<S3UploadInfo> {
        const splitFileName = origFileName.toLowerCase().split('.');
        let filename: string = Common.uniqueId();

        if(splitFileName.length > 1) {
            filename += `.${splitFileName[splitFileName.length - 1]}`;
        }

        const s3Params = {
            Bucket: bucketName,
            Key: `${directory}/${filename}`,
            //Expires: 60,
            ContentType: fileType
        };

        if(isPublic) {
            s3Params['ACL'] = 'public-read';
        }

        return new Promise(resolve => {
            getSignedUrl(this.s3, new PutObjectCommand(s3Params)).then(data => {
                const returnData = {
                    signedRequest: data,
                    url: `https://${bucketName}.s3.amazonaws.com/${directory}/${filename}`,
                    filename: filename
                };

                resolve(returnData);
            }).catch(err => {
                this.error(resolve, err as any, null, { name: 'getSignedUrl - putObject', statusCode: undefined, data: { bucketName, directory, filename, isPublic } });
                return;
            });
    });
    }

    upload(bucket: string, destinationKey: string, body: string, contentType: string, isPublic: boolean) {
        return new Promise<any>((resolve, reject) => {
            const params = {
                Bucket: bucket,
                Key: destinationKey,
                Body: body,
                ContentType: contentType
            };

            if(isPublic) {
                params['ACL'] = 'public-read';
            }

            this.s3.putObject(params, (err, res) => {
                if(err) {
                    this.error(reject, err as any, null, { name: 'putObject - upload', statusCode: err.statusCode, data: { bucket, destinationKey, contentType, isPublic } });
                }
                else {
                    resolve(res);
                }
            });
        });
    }

    put(bucket: string, directory: string, fileName: string, file: any, isPublic: boolean = false, options?: Pick<PutObjectCommandInput, 'Expires'>): Promise<string> {
        return new Promise((resolve, reject) => {
            const params: PutObjectCommandInput = {
                Bucket: bucket,
                Key: `${directory}/${fileName}`,
                Body: file,
                ContentType: Common.getContentTypeFromName(fileName),
                ...(options || {})
            };

            if(isPublic) {
                params.ACL = 'public-read';
            }

            this.s3.putObject(params, err => {
                if (err) {
                    this.error(reject, err as any, null, { name: 'putObject - put', statusCode: err.statusCode, data: { bucket, directory, fileName, isPublic, options } });
                    return;
                }
                if (!directory.endsWith('/')){
                    directory += '/';
                }
                resolve(`https://${bucket}.s3.amazonaws.com/${directory}${fileName}`);
            });
        });
    }

    getDisplayUrl(bucketName: string, directory: string, filename: string, downloadFilename?: string): Promise<ApiResponse<string>> {
        if(downloadFilename) {
            downloadFilename = downloadFilename.replace(UnicodeCharactersSimpleRegex, '');
        }

        return new Promise(resolve => {
            if (!filename) {
                this.error(resolve, `filename missing for display`, null);
                return;
            }

            const s3Params = { Bucket: bucketName, Key: `${directory}/${filename}` };

            if(downloadFilename) {
                s3Params['ResponseContentDisposition'] =`attachment; filename="${downloadFilename}"`;
            }
            
            getSignedUrl(this.s3, new GetObjectCommand(s3Params)).then(url => {
                resolve(new ApiResponse(true, url));
            }).catch(err => {
                this.error(resolve, err as any, null, { name: 'getSignedUrl - getObject', statusCode: undefined, data: { bucketName, directory, filename, downloadFilename } });
                return;
            });
        });
    }

    async getDisplayUrlByUrl(url: string, downloadFilename?: string): Promise<ApiResponse<string>> {
        if (!this.isS3Url(url)) {
            return new ApiResponse(true, url);
        }
        const parse = this.parseUrl(url);
        return this.getDisplayUrl(parse.bucketName, parse.directory, parse.filename, downloadFilename);
    }

    isS3Url(url: string) {
        return url && url.includes('s3.amazonaws.com');
    }

    async getRawObjectByUrl(url: string): Promise<ApiResponse<RawDocument>> {
        if (!this.isS3Url(url)) {
            return new ApiResponse(false);
        }
        else {
            const parse = this.parseUrl(url);
            const s3Params: GetObjectCommandInput = { Bucket: parse.bucketName, Key: `${parse.directory}/${parse.filename}` };

            const res = await this.s3.getObject(s3Params).then(async data => {
                const stream = data.Body as Readable;
                const buffer = await this.steamToBuffer(stream);
                return new ApiResponse(true, { content: buffer/*.toString('utf-8')*/, filename: parse.filename, contentType: data.ContentType, contentLength: data.ContentLength });
            }).catch(err => {
                return new ApiResponse(false, err);
            });

            if (!res.success) {
                this.error((data) => { return data; }, res.data as any, null, { name: 'getObject - raw-url', statusCode: res.data && res.data.statusCode, data: { parse } });
            }

            return res;
        }
    }

    private steamToBuffer(stream: Readable): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.once('end', () => resolve(Buffer.concat(chunks)));
            stream.once('error', reject);
        });
    }

    createDeploymentBucket(name: string, _region?: string) {
        console.log('creating s3 bucket', name);
        return new Promise<void>(async (resolve, reject) => {
            const params: CreateBucketCommandInput = {
                Bucket: name,
                ObjectOwnership: "ObjectWriter",
                /*CreateBucketConfiguration: {
                    LocationConstraint: this.defaultRegion || region
                }*/
            };

            let error = null;
            const data = await this.s3.createBucket(params).catch(err => {
                this.error(reject, err as any, null, { name: 'createBucket', statusCode: err.statusCode, data: { bucket: name } });
                error = err;
            });
            if (error) {
                return;
            }

            console.log(data);

            this.s3.deletePublicAccessBlock({ Bucket: name }, (err) => {
                if (err) { this.error(reject, err as any, null, { name: 'deletePublicAccessBlock', statusCode: err.statusCode, data: { bucket: name } }); return; }

                const params = {
                    Bucket: name,
                    CORSConfiguration: {
                        CORSRules: [{
                            "AllowedHeaders": ["Authorization", "Content-Length"],
                            "AllowedMethods": ["GET"],
                            "AllowedOrigins": ["*"],
                            "ExposeHeaders": [],
                            "MaxAgeSeconds": 3000
                        }]
                    }
                };

                this.s3.putBucketCors(params, async (err) => {
                    if (err) { this.error(reject, err as any, null, { name: 'putBucketCors', statusCode: err.statusCode, data: { bucket: name } }); return; }

                    const params = {
                        Bucket: name,
                        WebsiteConfiguration: {
                            ErrorDocument: {
                                Key: "index-app.html"
                            },
                            IndexDocument: {
                                Suffix: "index-app.html"
                            }
                        }
                    };

                    this.s3.putBucketWebsite(params, async (err) => {
                        if (err) { this.error(reject, err as any, null, { name: 'putBucketWebsite', statusCode: err.statusCode, data: { bucket: name } }); return; }
                        resolve();
                    });
                });
            });
        });
    }

    parseUrl(url: string) {
        url = url.replace('https://', '').replace('.s3.amazonaws.com', '');
        const split = url.split('/');
        const bucketName = split.shift();
        const directory = split.splice(0, split.length - 1).join('/');
        const filename = split[0];

        return { bucketName: bucketName, directory: directory, filename: filename };
    }

    buildUrl(fileUri: string, bucket: string) {
        return `https://${bucket}.s3.amazonaws.com/${fileUri}`;
    }

    protected error(resolve: (res: any) => void, msg: string, _auditUserId: string, _http?: { name: string, statusCode: number, data: any, alertSuppression?: { [key: string]: boolean | ((value: any) => boolean) }, [key: string]: any }) {
        this.log(msg);
        resolve(new ApiErrorResponse(msg));
    }
}