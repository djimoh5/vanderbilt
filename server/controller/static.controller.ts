import { BaseController, Get, Request, Response } from './base.controller';

var path = require("path");

import { Bootstrap, Injectable } from '../config/bootstrap';

@Injectable()
@Bootstrap()
export class StaticController extends BaseController {
	init() {}
	
	@Get('')
	index(_req: Request, res: Response) {
		var baseDir = path.resolve(__dirname, '../../ui/');

		res.sendFile(baseDir + '/dist/ui/browser/index.html');
	}
}