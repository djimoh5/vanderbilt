import { uniqueMd5Id } from '../../model/id.model';

const crypto = require('crypto');
const md5 = require('./md5.min.js');
const jwt = require('jsonwebtoken');

export class Crypto {
    private static algorithm: string = 'aes-256-ctr';
    private static inputEncoding: string = 'utf8';
    private static outputEncoding: BufferEncoding = 'hex';

    static sha256(msg: string) {
        return crypto.createHash('sha256').update(msg).digest('base64');
    }

    static sha1(msg: string) {
        return crypto.createHash('sha1').update(msg).digest('hex');
    }

    static hmac(msg: string, secret: string, resultEncoding: 'hex' | 'base64' = 'hex', encoding: 'ascii' | 'utf8' = 'ascii') {
        return crypto.createHmac('sha256', secret).update(msg, encoding).digest(resultEncoding);
    }

    static md5(msg: string): uniqueMd5Id {
        return md5(msg) as uniqueMd5Id;
    }

    static jwt(json: any, secret: string,  algorithm?: 'RS256' | 'HS256') {
        return jwt.sign(json, secret, algorithm ? { algorithm: algorithm } : undefined);
    }

    static jwtToken(json: any, secret: string, expiration: number, algorithm: 'RS256' | 'HS256') {
        return jwt.sign({ exp: (Math.floor(Date.now() / 1000) + expiration), data: json }, secret, algorithm ? { algorithm: algorithm } : undefined);
    }

    static decryptJwtToken(token: any, secret: string, algorithm: 'RS256' | 'HS256'): JwtToken {
        try {
            return jwt.verify(token, secret, algorithm ? { algorithms: [algorithm] } : undefined);
        } catch(e) {
            return null;
        }
    }

    static encrypt(plainText: string, secret: string) {
        const iv = Buffer.from(crypto.randomBytes(16));

        const cipher = crypto.createCipheriv(Crypto.algorithm, this.convertSecretToKey(secret), iv);
        let encrypted = cipher.update(plainText, this.inputEncoding, this.outputEncoding);
        encrypted += cipher.final(this.outputEncoding);

        return `${iv.toString('hex')}:${encrypted.toString()}`;
    }

    static decrypt(cypherText: string, secret: string) {
        const textParts = cypherText.split(':');
        const iv = Buffer.from(textParts.shift(), this.outputEncoding);
        const encryptedText = Buffer.from(textParts.join(':'), this.outputEncoding);

        const decipher = crypto.createDecipheriv(Crypto.algorithm, this.convertSecretToKey(secret), iv);
        let decrypted = decipher.update(encryptedText, this.outputEncoding, this.inputEncoding);
        decrypted += decipher.final(this.inputEncoding);

        return decrypted.toString();
    }

    private static convertSecretToKey(secret: string) {
        const keyLength = 32;
        if(secret.length > keyLength) {
            return secret.substring(0, keyLength);
        }

        while(secret.length < keyLength){
            secret += '0';
        }

        return secret;
    }
}

export interface JwtToken {
    exp?: number;
    data: any;
}