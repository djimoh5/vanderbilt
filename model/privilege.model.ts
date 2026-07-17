export class Privilege {
    constructor(public resource: PrivilegeResource, public access: PrivilegeAccess) {}

    public static isPrivilege(privilege: Privilege, requiredPrivilege: Privilege) {
        return privilege.resource === requiredPrivilege.resource 
            && privilege.access === requiredPrivilege.access;
    }

    toString() {
        return Privilege.toString(this);
    }

    static toString(privilege: Privilege) {
        return 'resource: ' + PrivilegeResource[privilege.resource] + ', access: ' + PrivilegeAccess[privilege.access];
    }
}

export enum PrivilegeResource {
    Agent = 1
}

export enum PrivilegeAccess {
    View = 1,
    Update = 2,
    Create = 3,
    Delete = 4
}

export class Privileges {
    static CRUD = (resource: PrivilegeResource) => [Privileges.Create(resource), Privileges.View(resource), Privileges.Update(resource), Privileges.Delete(resource)];
    static Create = (resource: PrivilegeResource) => ({ resource: resource, access: PrivilegeAccess.Create });
    static View = (resource: PrivilegeResource) => ({ resource: resource, access: PrivilegeAccess.View });
    static Update = (resource: PrivilegeResource) => ({ resource: resource, access: PrivilegeAccess.Update });
    static Delete = (resource: PrivilegeResource) => ({ resource: resource, access: PrivilegeAccess.Delete });
}