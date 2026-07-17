var request = require('request');

import { ErrorService } from './error.service';
import { ErrorType } from '../../model/error.model';
import { Bootstrap, Injectable } from '../config/bootstrap';

export interface IHttpService {
	get(options: GetOptions, callback: ResponseCallback);
}

export interface ResponseCallback {
	(err, data?, extraData?, statusCode?: number): void;
}

@Bootstrap()
@Injectable()
export class HttpService implements IHttpService {
	max: number = 10;
	active: number = 0;
	queue: {
		options: GetOptions;
		callback: ResponseCallback;
	}[] = [];

	constructor(private errorService: ErrorService) {

	}

	get(options: GetOptions, callback: ResponseCallback) {
		if (!options) {
			let req = this.queue.shift();
			options = req.options;
			callback = req.callback;
		}

		if (this.active < this.max) {
			this.active++;

			request(options, (error, response, body) => {
				this.active--;
				this.log(options.url, error, response, body);
				this.done(options.url, error, response && response.statusCode, body, callback);
			});
		}
		else {
			this.queue.push({ options: options, callback: callback });
		}
	}

	post(options: PostOptions, callback: ResponseCallback) {
		request.post(options, (error, response, body) => {
			let errorResponse = error || (response && response.statusCode >= 400 ? body : null);

			this.log(options.url, errorResponse, response, { options: options, body: body });
			this.done(options.url, errorResponse, response && response.statusCode, body, callback);
		});
	}

	private done(url: string, err: any, statusCode: number, data: any, callback: ResponseCallback, extData?: any) {
		if (callback) {
			try {
				data = JSON.parse(data);
			}
			catch (e) {
				this.log(url, err, null, { data, err, ex: e });
				callback(err, data || err, extData, statusCode);
				return;
			}

			callback(err, data || err, extData, statusCode);
		}

		if (this.queue.length > 0) {
			this.get(null, null);
		}
	}

	private log(url: string, error: any, response: any, _data: any) {
		if (error) {
			this.errorService.log({ error: error, url: url, status: response && response.statusCode }, ErrorType.CaughtException);
		}
		else {
			//this.errorService.logHttpSuccess(url, response && response.statusCode, { url: url, data: data });
		}
	}
}

export interface HttpOptions {
	url: string;
	name?: string;
	secureKeys?: string[];
}

export interface GetOptions extends HttpOptions {
	headers?: { [key: string]: string | number };
	json?: any;
}

export interface PostOptions extends HttpOptions {
	body?: string;
	json?: any;
	formData?: { [key: string]: any };
	headers?: { [key: string]: string | number };
}
