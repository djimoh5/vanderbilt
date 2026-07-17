import { Database, Collection, DBModel, DatabaseConnection } from './database';
import { Operations, UpdateOptions, SortOrder } from './operations';
import { IDatabaseContext, IDatabaseContextOptions } from './icontext';
import { PaginationModel } from '../../model/shared.model';
import { uniqueid } from '../../model/id.model';
import { Common } from '../../utility/common';
import { Filter } from 'mongodb';
import { MongoSanitizer } from './mongo-sanitizer';

export class DatabaseContext implements IDatabaseContext {
	protected collection: Collection;
	protected auditCollection?: Collection;
	private databaseOpenedPromise: Promise<any>;
	private dbType: DatabaseConnection;
	private auditLogRequests: { promise: Promise<any>, id: uniqueid }[] = [];

	constructor(public collectionName: string, private options: IDatabaseContextOptions = {}) {
		if (collectionName.startsWith('audit.')){
			if (!options.explicitConnection) {
				options.connection = DatabaseConnection.AUDIT;
			}
			options.disableAuditLogs = true;
		}
		
		this.dbType = options.connection || DatabaseConnection.APP;
		if (Database.getMongo(this.dbType)) {
			this.initCollection(collectionName);
		}
		else {
			this.databaseOpenedPromise = Database.open(this.dbType);

			this.databaseOpenedPromise.then((connected) => {
				if (connected){
					this.initCollection(collectionName);
				}
			});
		}
	}

	private initCollection(collectionName: string) {
		this.collection = Database.getMongo(this.dbType).collection(collectionName);

		if (!this.options.disableAuditLogs) {
			if (Database.getMongo(DatabaseConnection.AUDIT)) {
				this.auditCollection = Database.getMongo(DatabaseConnection.AUDIT).collection(`audit.${collectionName}`);
			}
			else {
				Database.open(DatabaseConnection.AUDIT).then(() => {
					this.auditCollection = Database.getMongo(DatabaseConnection.AUDIT).collection(`audit.${collectionName}`);
				});
			}
		}
	}

	private setTenant(data: any, isInsert: boolean = false, isRemove: boolean = false) {
		if (!Common.isNullOrUndefined(this.options.tenantId) && !data._tid) {
			if (isInsert || isRemove || !this.options.searchGlobalObjects) {
				data._tid = this.options.tenantId;
			}
			else if (!this.options.searchGlobalObjects || isRemove) {
				data._tid = this.options.tenantId;
			}
			else {
				const tenantOr: any[] = [{ _tid: this.options.tenantId }, { _tid: null }];
				
				if (data.$or){
					data.$and = [
						{ $or: data.$or },
						{ $or: tenantOr }
					];
					
					delete data.$or;
				}
				else {
					data.$or = tenantOr;
				}
			}
		}

		return data;
	}

	private async auditLog(query: any, data: DBModel, auditUserId: string): Promise<{ isUpdate: boolean }> {
		let isUpdate = false;

		if (data) {
			data._ts = Date.now();

			if (auditUserId) {
				data._u = auditUserId;
			}
		}

		if (query) {
			const currObj: DBModel = await this.findOne(query, null);
			if (currObj) {
				isUpdate = true;

				if (!this.auditCollection){
					return { isUpdate: isUpdate };
				}

				currObj._tsu = Date.now();

				if (auditUserId) {
					currObj._uu = auditUserId;
				}

				currObj.og_id = currObj._id;
				delete currObj._id;
				const uniqueAuditPromise = { promise: null, id: Common.uniqueId() };
				uniqueAuditPromise.promise = this.auditCollection.insertOne(currObj);
				this.auditLogRequests.push(uniqueAuditPromise);
				uniqueAuditPromise.promise.then(() => {
					this.auditLogRequests.splice(this.auditLogRequests.findIndex(i => i.id === uniqueAuditPromise.id), 1);
				});
			}
		}

		return { isUpdate: isUpdate }; //return whether this is an update of existing data
	}

	onConnect(): Promise<boolean> {
		if (this.isConnected()) {
			return Promise.resolve(true);
		}
		else {
			return this.databaseOpenedPromise.then(() => {
				return true;
			});
		}
	}

	isConnected(): boolean {
		return !!this.collection;
	}

	find(query: Filter<any>, fields?: { [key: string]: 1 | 0 }, operations?: Operations, mapper?: (data: any) => any): Promise<any[]> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);
		
		return new Promise(async (resolve, reject) => {
			let cursor = fields ? this.collection.find(query, { projection: fields }) : this.collection.find(query);

			if (operations) {
				for (let key in operations) {
					cursor[key](operations[key]);
				}
			}

			let results: any[] = [];

			await cursor.forEach(doc => {
				doc.id = doc._id.toString();
				results.push(mapper ? mapper(doc) : doc);
			});
			
			cursor.close();

			this.promiseCallback(resolve, reject, null, results);
		});
	}

	findOne(query: Filter<any>, fields?: { [key: string]: 1 | 0 }, isPlatformAgnostic?: boolean): Promise<any> {
		MongoSanitizer.blockDangerousOperators(query);
		if (!isPlatformAgnostic) {
			this.setTenant(query);
		}

		return new Promise((resolve, reject) => {
			if (fields) {
				this.collection.findOne(query, { projection: fields }, (err, doc) => {
					if(doc) {
						doc.id = doc._id.toString();
					}

					this.promiseCallback(resolve, reject, err, doc);
				});
			}
			else {
				this.collection.findOne(query, (err, doc) => this.promiseCallback(resolve, reject, err, doc));
			}
		});
	}

	findIds(ids: string[], fields?: { [key: string]: 1 | 0 }, operations?: Operations, searchField?: string, mapper?: (data: any) => any): Promise<any[]> {
		ids = ids.filter(i => !Common.isNullOrUndefined(i));

		let query: any = { _id: { $in: ids.map(id => new Database.ObjectID(id)) } };
		if (searchField) {
			query = { $or: [query, { [searchField]: { $in: ids }}] };
		}
		return this.find(query, fields, operations, mapper);
	}

	insert(data: any, auditUserId: string): Promise<any> {
		this.setTenant(data, true);
		this.auditLog(null, data, auditUserId);

		return new Promise((resolve, reject) => {
			this.collection.insertOne(data, (err, result) => {
				if(result && result.insertedId) { data.id = result.insertedId.toString(); }
				this.promiseCallback(resolve, reject, err, data)
			});
		});
	}

	async update(query: Filter<any>, data: any, auditUserId: string, options?: UpdateOptions): Promise<any> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);

		if (options && options.setOnInsert) {
			options.upsert = true; //always has to be true
		}

		this.setTenant(data, true);
		const _u = data._u;
		const auditResult = await this.auditLog(query, data, auditUserId); //return whether data exists

		return new Promise((resolve, reject) => {
			const id = data._id ? data._id.toString() : data.id;
			delete data._id;
			delete data.id;

			if (!options || !options.upsert || auditResult.isUpdate) {
				//don't override existing reserved variables
				delete data._ts;
				delete data._u;
			}

			if (options && options.creatorChange) {
				data._u = _u;
			}

			if (!options || !options.setOnInsert) {
				//we're only setting data if it doesn't exist, this doesn't need update flags
				data._tsu = Date.now();
	
				if(auditUserId) {
					data._uu = auditUserId;
				}
			}

			if(options && options.unset) {
				if(options.multi) {
					this.collection.updateMany(query, { $unset: data }, {}, err => {
						if (id) { data._id = id; }
						data.id = data._id.toString();
						this.promiseCallback(resolve, reject, err, data);
					});
				}
				else {
					this.collection.updateOne(query, { $unset: data }, {}, err => {
						if (id) { data._id = id; }
						data.id = data._id.toString();
						this.promiseCallback(resolve, reject, err, data);
					});
				}	
			}
			else {
				const setData = options && options.setOnInsert? { $setOnInsert: data } : { $set: data }; //options && options.aggregate? [{ $set: data }] :
				if(options && options.multi) {
					this.collection.updateMany(query, setData, options, err => {
						if (id) { data._id = id; }
						this.promiseCallback(resolve, reject, err, data);
					});
				}
				else {
					this.collection.updateOne(query, setData, options || {}, (err, result) => {
						if (id) { data.id = data._id = id; }
						if(result && result.upsertedId) { data.id = result.upsertedId.toString(); }
						this.promiseCallback(resolve, reject, err, data);
					});
				}
			}
		});
	}

	append(query: Filter<any>, data: any, auditUserId: string): Promise<any> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);
		this.auditLog(query, null, auditUserId);

		return new Promise((resolve, reject) => {
			let id = data._id;
			delete data._id;

			this.collection.updateMany(query, { $push: data, $set: { _tsu: <never>Date.now() } }, err => {
				if (id) {
					data._id = id;
				}

				this.promiseCallback(resolve, reject, err, data);
			});
		});
	}

	pull(query: Filter<any>, data: any, auditUserId: string, options?: UpdateOptions): Promise<any> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);
		this.auditLog(query, null, auditUserId);

		return new Promise((resolve, reject) => {
			const id = data._id;
			delete data._id;
			
			this.collection.updateOne(query, { $pull: data, $set: { _tsu: Date.now() } }, options || {}, err => {
				if (id) {
					data._id = id;
				}

				this.promiseCallback(resolve, reject, err, data);
			});
		});
	}

	remove(query: Filter<DBModel>, auditUserId: string): Promise<boolean> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query, false, true);
		this.auditLog(query, null, auditUserId);

		return new Promise((resolve, reject) => {
			this.collection.deleteMany(query, (err) => this.promiseCallback(resolve, reject, err, true));
		});
	}

	count(query: Filter<any>): Promise<number> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);

		return new Promise((resolve, reject) => {
			this.collection.count(query, (err, count) => this.promiseCallback(resolve, reject, err, count));
		});
	}

	findCollisions(field: string): Promise<{ _id: string, sum: number }[]> {		
		return new Promise(async (resolve, reject) => {
			const cursor = this.collection.aggregate([{ $group: { _id: `$${field}`, sum: { $sum: 1 } } }, { $match: { sum: { $gt: 1 } } }]);
			
			let results: any[] = [];

			await cursor.forEach(doc => {
				results.push(doc);
			});
			
			cursor.close();

			this.promiseCallback(resolve, reject, null, results);
		});
	}

	sum(query: Filter<any>, sumField: string, groupByField: string): Promise<{ _id: string, sum: number }[]> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);
		
		return new Promise(async (resolve, reject) => {
			const cursor = this.collection.aggregate([{ $match: query }, { $group: { _id: `$${groupByField}`, sum: { $sum: `$${sumField}` } } }]);
			
			let results: any[] = [];

			await cursor.forEach(doc => {
				results.push(doc);
			});
			
			cursor.close();

			this.promiseCallback(resolve, reject, null, results);
		});
	}

	max(query: Filter<any>, maxField: string, groupByField: string): Promise<any[]> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);

		return new Promise(async (resolve, reject) => {
			//commented out $max operation as not needed, extra operation provides no benefit since we need entire doc
			const cursor = this.collection.aggregate([{ $match: query }, { $sort: { [maxField]: -1 } }, { $group: { _id: `$${groupByField}`, /*maxDate: { $max: `$${maxField}` },*/ data: {$first: '$$ROOT'} } }]);
			
			let results: any[] = [];

			await cursor.forEach(doc => {
				results.push(doc.data);
			});
			
			cursor.close();

			this.promiseCallback(resolve, reject, null, results);
		});
	}

	async page(query: Filter<any>, pageNumber: number, pageSize: number, fields?: { [key: string]: 1 | 0 }, mapper?: (data: any) => any, sorter = { _ts: SortOrder.Descending }): Promise<PaginationModel<any>> {
		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);

		if (pageNumber === 0){
			throw new Error('Paging starts at 1');
		}

        if(!pageSize) {
            const results = await this.find(query, fields, { sort: sorter }, mapper);
            return {
                results: results,
                page: 1,
                pageSize: results.length,
                totalItems: results.length
            };
        }

		const count = await this.count(query);
		const results = await this.find(query, fields, Operations.PageSort(pageNumber, pageSize, sorter), mapper);
		return {
			page: pageNumber, pageSize: pageSize, totalItems: count, results: results
		};
	}

	distinct(field: string, query: { [key: string]: any }): Promise<any[]> {
		if (!query) {
			query = {};
		}

		MongoSanitizer.blockDangerousOperators(query);
		this.setTenant(query);

		return new Promise((resolve, reject) => {
			this.collection.distinct(field, query, (err, docs) => this.promiseCallback(resolve, reject, err, docs));
		});
	}

	protected promiseCallback(resolve, reject, err, results?) {
		if (err) {
			reject(err);
		}
		else {
			resolve(results);
		}
	}

	async waitForAuditLog() {
		await Promise.all(this.auditLogRequests.map(p => p.promise));
	}
}