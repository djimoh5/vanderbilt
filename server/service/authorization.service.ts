import { Bootstrap, Injectable } from "../config/bootstrap";
import { Privilege } from "../../model/privilege.model";
import { User } from "../../model/user.model";
import { AppService } from "./app.service";
import { BaseService } from "./base.service";

@Injectable()
@Bootstrap()
export class AuthorizationService extends BaseService {

    constructor(appService: AppService) {
        super(appService);
    }

    async isAuthorized(user: User, _authPrivilege: Privilege, _id?: string): Promise<boolean> {
        return user && user.token ? true : false;
    }
}