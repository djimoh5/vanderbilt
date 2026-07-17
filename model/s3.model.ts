export interface S3UploadInfo { 
    signedRequest: string, 
    url: string,
    filename: string
}

export interface S3Object {
    Key: string;
    LastModified: Date;
    Etag: string;
    Size: number;
    StorageClass: string;
}

export interface RawDocument {
    content: string | Buffer;
    filename: string;
    contentType: string;
    contentLength: number;
}

export interface CloudFrontDistribution {
    Id: string;
    ARN: string;
    DomainName: string;
    Aliases: {
        Quantity: number,
        Items: string[];
    },
    Origins: {
        Items: { DomainName: string }[]
    },
    ViewerCertificate: {
        CloudFrontDefaultCertificate: boolean,
        MinimumProtocolVersion: TLSVersions,
        CertificateSource: 'cloudfront' | 'acm',
        ACMCertificateArn?: string;
        Certificate: string;
        SSLSupportMethod: 'sni-only';
    }
}

export enum TLSVersions {
    'TLSv1_2_2021' = 'TLSv1.2_2021',
    'TLSv1' = 'TLSv1'
}

export interface AWSCertificate {
    CertificateArn: string;
    DomainName: string;
    DomainValidationOptions: [{ 
        DomainName: string;
        ResourceRecord: { 
            Name: string;
            Type: string; 
            Value: string; 
        },
        ValidationStatus: string;
    }],
    Status: 'ISSUED' | 'PENDING_VALIDATION'
}

export interface S3UploadInfo { 
    signedRequest: string, 
    url: string,
    filename: string
}