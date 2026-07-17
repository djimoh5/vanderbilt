export type uniqueid = string & { _uniqueIdBrand: undefined };
export type uniqueMd5Id = string & { _uniqueMd5Id: undefined };
export type authid = uniqueid & { _userIdBrand: undefined };

export function UniqueId(id: string): uniqueid {
    return id as uniqueid;
}

export function AuthId(id: string): authid {
    return id as authid;
}