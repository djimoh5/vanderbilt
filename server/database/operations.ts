export class Operations {
    sort?: { [key: string]: SortOrder };
    skip?: number;
    limit?: number;

    public static Page(pageNumber: number, pageSize: number, sort: SortOrder = SortOrder.Descending): Operations {
        return { sort: { _ts: sort }, skip: pageSize * (pageNumber-1), limit: 1 * pageSize };
    }

    public static PageSort(pageNumber: number, pageSize: number, sort: {[key: string]: SortOrder}): Operations {
        return { sort: sort, skip: pageSize * (pageNumber-1), limit: 1 * pageSize };
    }
}

export interface UpdateOptions {
    upsert?: boolean;
    multi?: boolean;
    unset?: boolean;
    setOnInsert?: boolean;
    creatorChange?: boolean;
}

export enum SortOrder {
    Ascending = 1,
    Descending = -1
}