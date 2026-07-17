import { BaseController, Get, Post, Request, Response, AllowAnonymous, NoAuth } from './base.controller';

import { Bootstrap, Injectable } from '../config/bootstrap';

import { AuthService } from '../service/auth.service';
import { S3Service } from '../service/s3.service';
import { UserProfileService } from '../service/user-profile.service';

import { ApiResponse } from '../../model/shared.model';
import { UserAuth } from '../../model/auth.model';
import { AuthId } from '../../model/id.model';
import { Config } from '../config/config';

@Injectable()
@Bootstrap()
@AllowAnonymous()
export class APIController extends BaseController {
	constructor(private authService: AuthService, private userProfileService: UserProfileService, private s3Service: S3Service) {
		super();
	}

	async init(_req: Request) {

	}

	@NoAuth()
	@Post('auth/create')
	async authenticateOrCreate(req: Request, res: Response) {
		this.completeAuthentication(req, res, req.body.username, req.body.password, true, false)
	}

	private async completeAuthentication(req: Request, res: Response, username: string, password: string, create: boolean, bypassPassword: boolean) {
		const data = await this.authService.authenticate(username, password, create, bypassPassword, req.session.tenantId);
		if (data.success) {
			req.session.user = data.data;
			await this.init(req);
			req.session.start(data.data);
		}

		res.send(data);
	}

	@NoAuth()
	@Post('auth/update')
	async updateAuth(req: Request, res: Response) {
		const data = await this.authService.updateAuth(req.body.username, req.body.password, req.body.newPassword);
		res.send(data);
	}

	@NoAuth()
	@Post('auth')
	async authenticate(req: Request, res: Response) {
		let data: ApiResponse<UserAuth>;

		if (req.session.user && req.session.user.token) {
			data = await this.authService.authenticate(req.session.user.username, null, false, true);
		}
		else if (req.body) {
			data = await this.authService.authenticate(req.body.username, req.body.password);
		}

		if (!data) {
			return this.sendError(res, 'authentication failed');
		}

		if (data.success) {
			req.session.start(data.data);
		}

		res.send(data);
	}

	@NoAuth()
	@Post('auth/code/request')
	async requestLoginCode(req: Request, res: Response) {
		const { username } = req.body;
		if (!username) {
			return this.sendError(res, 'username is required');
		}
		const data = await this.authService.requestLoginCode(username);
		res.send(data);
	}

	@NoAuth()
	@Post('auth/code/verify')
	async verifyLoginCode(req: Request, res: Response) {
		const { username, code } = req.body;
		if (!username || !code) {
			return this.sendError(res, 'username and code are required');
		}
		const data = await this.authService.verifyLoginCode(username, code);
		if (data.success) {
			req.session.start(data.data);
		}
		res.send(data);
	}

	@NoAuth()
	@Post('auth/password/reset')
	async requestPasswordReset(req: Request, res: Response) {
		const { username } = req.body;
		if (!username) {
			return this.sendError(res, 'username is required');
		}
		const data = await this.authService.requestPasswordReset(username);
		res.send(data);
	}

	@NoAuth()
	@Post('auth/password/reset/confirm')
	async resetPassword(req: Request, res: Response) {
		const { username, code, newPassword } = req.body;
		if (!username || !code || !newPassword) {
			return this.sendError(res, 'username, code, and newPassword are required');
		}
		const data = await this.authService.resetPassword(username, code, newPassword);
		res.send(data);
	}

	@Get('user/profile')
	async getProfile(req: Request, res: Response) {
		const data = await this.userProfileService.getProfile(AuthId(req.session.user.oid));
		res.send(data);
	}

	@Post('user/profile')
	async updateProfile(req: Request, res: Response) {
		const { firstName, lastName } = req.body;
		if (!firstName || !lastName) {
			return this.sendError(res, 'firstName and lastName are required');
		}
		const data = await this.userProfileService.updateProfile(AuthId(req.session.user.oid), firstName, lastName);
		res.send(data);
	}

	@Post('auth/invite')
	async invite(req: Request, res: Response) {
		const { username } = req.body;
		if (!username) {
			return this.sendError(res, 'username is required');
		}
		const data = await this.authService.invite(username, req.session.user.oid, req.session.tenantId);
		res.send(data);
	}

	@NoAuth()
	@Post('auth/invite/redeem')
	async redeemInvite(req: Request, res: Response) {
		const { code } = req.body;
		if (!code) {
			return this.sendError(res, 'code is required');
		}
		const data = await this.authService.redeemInviteCode(code);
		if (data.success) {
			req.session.user = data.data;
			await this.init(req);
			req.session.start(data.data);
		}
		res.send(data);
	}

	@Get('upload/info')
	async getUploadInfo(req: Request, res: Response) {
		const result = this.s3Service.getUploadInfo(Config.S3_BUCKET.DOCUMENTS, '', req.query.filename, req.query.fileType, req.query.isPublic === 'true');
		this.sendSuccess(res, result);
	}
}