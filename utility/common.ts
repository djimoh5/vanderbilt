import { uniqueid, uniqueMd5Id } from "../model/id.model";
import uuidv4 from 'uuid';

declare const md5: any;
declare const jaroDistance: any;
declare const formatDate: any;
declare const _: any;

class DateFormat {
    static sqlDate = 'yyyy-MM-dd';
    static sqlDateTime = 'yyyy-MM-dd hh:mm:ss';
    static fileDateTime = 'yyyy-MM-dd_hh-mm';
    static date = 'MM/dd/yyyy';
    static dateTime = 'MM/dd/yyyy hh:mm tt';
    static dateTime24Hr = 'MM/dd/yyyy HH:mm';
    static dateTimeZone = 'MM/dd/yyyy hh:mm tt "UTC"z';
    static longDateTime = 'MM/dd/yyyy hh:mm:ss tt';
    static time = 'hh:mm tt';
    static longTime = 'hh:mm:ss:fff tt';
    
    static mediumDate = 'MMM d, yyyy';
    static longDate = 'MMMM d, yyyy';
}

export class Common {
    static passwordMask = '.................';
    
	static objectToArray (obj: any, skipKey?: string) {
		const arr: { key: string, value: any }[] = [];

		for(const key in obj) {
            if (key !== skipKey){
                arr.push({ key: key, value: obj[key] });
            }
		}

		return arr;
	}
    
    static padDatePart (datePart: any) {
	    datePart = "" + datePart;

	    if(datePart.length == 1) {
	    	return "0" + datePart;
        }
	    
	    return datePart;
	}
	
	static getYear(date: string | Date) {
		const d = typeof date === 'string'? new Date(date) : date;
		return d.getFullYear();
	}

    static daysInMonth(month: number, year: number) {
        return new Date(year, month, 0).getDate();
    }
	
	static getMonthNameAndYear(date: string | Date) {
		const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		const d = typeof date === 'string'? new Date(date) : date;
		return monthNames[d.getMonth()] + " " + this.getYear(d);
	}
	
	static getWeekMonthNameAndYear(date: string | Date) {
		const d = typeof date === 'string'? new Date(date) : date;
        const week = Math.ceil(d.getDate() / 7);
		return week + " " + this.getMonthNameAndYear(d);
	}

    static pastDate(daysAgo: number): Date {
        const dateAgo = new Date();
        dateAgo.setDate(dateAgo.getDate() - daysAgo);
        return new Date(dateAgo);
    }

	static isNumber (n: any) {
		return !isNaN(parseFloat(n)) && isFinite(n);
	}

	static isDefined (o: any) {
		return typeof(o) !== 'undefined';
    }
    
    static isNullOrUndefined (o: any) {
		return typeof(o) === 'undefined' || o === null;
	}
    
    static isEmpty (o: any) {
		return Common.isNullOrUndefined(o) 
            || (typeof(o) === 'object' && Object.keys(o).length === 0) 
            || (typeof(o) === 'string' && o === '')
            || (Common.isArray(o) && o.length === 0);
	}

	static inArray(item: any, arr: any[]) {
		return arr.indexOf(item) > -1;
	}

	static isString(data: any): boolean {
		return Object.prototype.toString.call(data) === '[object String]';
	}

	static isArray(data: any): boolean {
		return Object.prototype.toString.call(data) === '[object Array]';
	}

	static isObject(data: any): boolean {
		return Object.prototype.toString.call(data) === '[object Object]';
    }

    static isDateValid(date: Date) {
        return !isNaN(date.getTime());
    }

    static hasKeys(obj: {}) {
        if(obj) {
            for(const key in obj) {
                if(obj.hasOwnProperty(key)) {
                    return true;
                }
            }
        }

        return false;
    }

    static validEmail(email: string) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

    static validWebsite(website: string) {
        const re = /^(http[s]?:\/\/(www\.)?){1}([0-9A-Za-z-\.@:%_\+~#=]+)+(((\.[a-zA-Z]{2,3})|([a-zA-Z]{2,3}:[0-9]*))+)(\/(.)*)?(\?(.)*)?/;
        return re.test(website);
    }

    static ucFirst(str: string) {
        if(!str) {
            return "";
        }

        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }

    static ucWords(str: string) {
        const words = str.split(" ");

        for (let i = 0; i < words.length; i++) {
            words[i] = this.ucFirst(words[i]);
        }

        return words.join(" ");
    }

    static camelCaseToWords(str: string) {
        return str ? str.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/^./, function(str){ return str.toUpperCase(); }).replace(' And ', ' and ').trim() : '';
    }

    static parseDate (str: any, format: number = -1) {
		let date: Date;

        if(!str) {
            return null;
        }

		switch(format) {
			case 1:
				const split = str.split('/');
				if(split[0].substring(0, 1) == '0') {
					split[0] = split[0].substring(1,2);
                }
				date = new Date(parseInt(split[2]), parseInt(split[0]) - 1, parseInt(split[1]), 0, 0, 0, 0);
				break;
            case 2:
                const timeSplit = str.split('T');
				const datePart = timeSplit[0].split('-');
				const timePart = timeSplit[1] ? timeSplit[1].split('.')[0] : '';
                date = new Date(datePart[1] + '/' + datePart[2] + '/' + datePart[0] + ' ' + timePart);
                break;
			default:
                str = str + "";
				let monthPart = str.substring(4, 6);
				if(monthPart.substring(0, 1) == '0') {
					monthPart = monthPart.substring(1, 2);
				}
				date = new Date(parseInt(str.substring(0, 4)), parseInt(monthPart) - 1, parseInt(str.substring(6, 8)), 0, 0, 0, 0);     
		}

		return isNaN(date.getTime()) ? null : date;
    }
    
    static DateFormat = DateFormat;
    static formatDate(date: Date, format: string, options?: {}) {
        return formatDate(date, format, options);
    }
    
    static formatDBDate(date: number, format: string, options?: {}) {
        return formatDate(this.parseDate(date), format, options);
    }
    
    static dbDate(date: Date): number {
        return parseInt(date.getFullYear() + Common.padDatePart(date.getMonth() + 1) + Common.padDatePart(date.getDate()));
    }
    
    static dateToUnixTime(date: Date) {
        return Math.round(date.getTime() / 1000);
    }

    static round(num: number, places: number) {
		if(places && places > 0) {
			num = parseFloat(Math.round(num * Math.pow(10, places)) / Math.pow(10, places) + '');
			
			if(!isNaN(num)) {
				return num;
            }
			else {
				return 0;
            }
		}
		else {
			return Math.round(num);
        }
    }
    
    static addCommas(nStr: any) {
		nStr += '';
		const x = nStr.split('.');
		let x1 = x[0];
		const x2 = x.length > 1 ? '.' + x[1] : '';
		
		const rgx = /(\d+)(\d{3})/;
		
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		
		return x1 + x2;
    }

    static divide(a: number, b: number, floor?: boolean) {
        let division = parseFloat(parseFloat(`${a / b}`).toPrecision(12));
        if (floor) {
            division = Math.floor(division);
        }
        return division;
    }

    static formatValue(val: number | string, decimals: number = 2, showNonZeroDecimals: boolean = false, showAllDecimals: boolean = false) {
        let value: any = val;
        
        if (typeof val === 'string') {
            if (Common.isNumber(val)) {
                value = parseFloat(val);
            }
        }

        if (!Common.isNumber(value)) {
            return value;
        }

        const numberValue = value;
        value = Common.round(value, decimals);

        if (showNonZeroDecimals || showAllDecimals) {
            const decimalPart = (numberValue % 1).toFixed(decimals);
            const padding = new Array(decimals).fill('0').join('');

            if (decimalPart !== `0.${padding}` || showAllDecimals) {
                value = numberValue.toFixed(decimals);
            }
        }
        return Common.addCommas(value);
    }

    static formatPriceAbbrev(val: number, decimals: number = 2) {
        return this.formatValueAbbrev(val, decimals);
    }
    
    static formatValueAbbrev(val: number, decimals: number = 2) {
        const formatters: [number, string][] = [[1000000000, 'B'], [1000000, 'M'], [1000, 'K']];
        let abbrev = '';

        for(let i = 0, formatter: [number, string]; formatter = formatters[i]; i++) {
            if(val >= formatter[0]) {
                val = val / formatter[0];
                abbrev = formatter[1];
                break;
            }
        }

        return `${Common.formatValue(val, decimals)}${abbrev}`;
    }

    static unformatValue(val: string) {
        return val && !!val.replace ? parseFloat(val.replace(/,/g, '')) : val;
    }

    static formatPercent(val: number, decimals: number) {
        return this.formatValue(val * 100, decimals) + '%';
    }

    static formatTime(seconds: number, decimals: number = 2) {
        const formatters: [number, string][] = [[86400, 'days'], [3600, 'hrs'], [60, 'min']];
        let abbrev = 's';

        for(let i = 0, formatter: [number, string]; formatter = formatters[i]; i++) {
            if(seconds >= formatter[0]) {
                seconds = seconds / formatter[0];
                abbrev = formatter[1];
                break;
            }
        }

        return `${Common.formatValue(seconds, decimals)} ${abbrev}`;
    }
    
    static sort<T>(values: T[], sortBy: string, hasIndexKey?: boolean): T[] {
        let sortAscFlag = 1;

        if (sortBy.substring(0, 1) == '-') {
            sortAscFlag = -1;
            sortBy = sortBy.substring(1);
        }

        values.sort((a, b) => {
            const valA = this.valueFromKeyString(a, sortBy, hasIndexKey),
                valB = this.valueFromKeyString(b, sortBy, hasIndexKey);

            if (valB == null) {
                return -1;
            }
            else if (valA == null) {
                return 1;
            }
            else if (typeof valA === 'string' && typeof valB === 'string') {
                return (valA.localeCompare(valB)) * sortAscFlag;
            }
            else {
                return (valA <= valB ? -1 : 1) * sortAscFlag;
            }
        });

        return values;
    }

    private static valueFromKeyString(obj: any, key: string, hasIndexKey?: boolean) {
        const keys = key.split('.');

        for (let i = 0, len = keys.length; i < len; i++) {
            const k = hasIndexKey && Common.isNumber(keys[i])? parseInt(keys[i]) : keys[i];

            if (typeof obj[k] !== 'undefined') {
                obj = obj[k];
            }
            else {
                return null;
            }
        }

        return obj;
    }

    static arrayToObject(keys: string[], populateFunction: ((key: string) => any) = () => ''): any {
        return keys.reduce((obj: any, curr: any) => (obj[curr] = populateFunction(curr), obj), {});
    }

    static arrayToHashTable<T>(arr: T[], key: keyof T, keyFunction?: (item: T) => any) {
        const hash: { [key: string]: T } = {};
        for(let i = 0, len = arr.length; i < len; i++) {
            hash[keyFunction ? keyFunction(arr[i]) : arr[i][key]] = arr[i];
        }
        return hash;
    }

    static multiArrayToHashTable<T>(arr: T[], key: keyof T, keyTransform?: (key: any) => any) {
        const hash: { [key: string]: T[] } = {};
        for(let i = 0, len = arr.length; i < len; i++) {
            const hk: string = keyTransform ? keyTransform(arr[i][key]) : arr[i][key] as any;
            if(!hash[hk]) {
                hash[hk] = [];
            }

            hash[hk].push(arr[i]);
        }
        return hash;
    }

    static valueFromJsonPath(json: any, path: string) {
        return this.partsFromJsonPath(json, path).value;
    }

    static partsFromJsonPath(json: any, path: string) {
        if(!path) { return { value: undefined, parent: json, paths: [] } };
        if(json[path] || json[path] === 0) { return { value: json[path], parent: json, paths: [path] } };
        let paths = path.split('.');
        const pathLen = paths.length;
        let index = 0;
        let parent = json;

        while(json && index < pathLen) {
            json = json[paths[index++]];
            if (typeof json === 'object') {
                parent = json;
            }
        }

        if(!json && json !== 0 && index < pathLen && parent) { //if at dead end but there are more paths, check against remaining full path
            json = parent[paths.slice(index - 1).join('.')];
        }

        return { value: json, parent: parent, paths: paths };
    }

    static removeValueAtJsonPath(json: any, path: string, replaceValue?: any, set?: boolean) {
        const paths = path.split('.');
        const pathLen = paths.length;
        let index = 0;

        while(json && index < (pathLen - 1)) {
            json = json[paths[index++]];
        }

        if(json) {
            if(replaceValue || set) {
                if(json[paths[index]] || set) {
                    json[paths[index]] = replaceValue;
                }
            }
            else {
                delete json[paths[index]];
            }
        }
    }

    static setValueAtJsonPath(json: any, path: string, replaceFunction: (currentValue?: any) => string, includesArrayPath: boolean = false) {
        const paths = includesArrayPath? path.split('.').map(path => this.isNumber(path)? parseInt(path) : path) : path.split('.');
        const pathLen = paths.length;
        let index = 0;

        while(typeof json !== 'undefined' && index < (pathLen - 1)) {
            const path = paths[index++];
            if (typeof json[path] === 'undefined') {
                json[path] = {};
            }
            json = json[path];
        }

        if(typeof json !== 'undefined') {
            json[paths[index]] = replaceFunction(json[paths[index]]);
        }
    }

    static replaceValueAtJsonPath(json: any, path: string, replaceFunction: (currentValue: any) => string) {
        const paths = path.split('.');
        const pathLen = paths.length;
        let index = 0;

        while(json && index < (pathLen - 1)) {
            json = json[paths[index++]];
        }

        if(json && typeof json[paths[index]] !== 'undefined') {
            json[paths[index]] = replaceFunction(json[paths[index]]);
        }
    }

    static randomNonce() {
        return parseInt('' + Math.round(Math.random() * 10000000) + Math.round(Math.random() * 10000000));
    }

	static uniqueId(): uniqueid {
		return uuidv4();
    }

    static uniqueMd5(data?: string): uniqueMd5Id {
        return md5(data ? data : ("" + Date.now() + Math.round(Math.random() * 1000000) + Math.round(Math.random() * 1000000)));
    }

    static base64Encode(text: string) {
        return btoa(text);
    }
    
    static pad(width: number, content: any, pad = '0'){
        //Is there a better way to fill an array with width number of pad. 
        const padding = new Array(width).fill(pad).join('');
        return (padding + (content || '')).slice(-width)
    }

    static distinct<T>(ary: T[], lookup?: (item: T) => any): T[] {
        const used: { [key: string]: boolean } = {};
        const results: T[] = [];

        for (let index = 0; index < ary.length; index++) {
            const value = ary[index];
            if (Common.isNullOrUndefined(value)) {
                continue;
            }
            let key = lookup ? lookup(value) : value;
            if (lookup && Common.isNullOrUndefined(key)) {
                continue;
            }
            if(!used[key]) {
                results.push(value);
                used[key] = true;
            }
        }

        return results;
    }

    static getMimeTypeFromFilename(filename: string) {
        if(filename.indexOf('.jpg') > 0 || filename.indexOf('.jpeg') > 0) {
            return'image/jpeg';
        }
        else if(filename.indexOf('.png') > 0) {
            return'image/png';
        }
        else if(filename.indexOf('.pdf') > 0) {
            return 'application/pdf';
        }

        return null;
    }

    static enumToKeyList<T extends string|number, TEnumValue>(en: { [key in T]: TEnumValue }): { key: string, value: TEnumValue}[] {
        const list: { key: string, value: TEnumValue }[] = [];

        for(const index in en) {
            if(!Common.isNumber(index)) {
                list.push({
                    key: Common.camelCaseToWords(index),
                    value: en[index]
                });
            }
        }

        return list;
    }

    static enumToList<T extends string|number, TEnumValue>(en: { [key in T]: TEnumValue }): TEnumValue[] {
        const list: TEnumValue[] = [];

        for(const index in en) {
            if(!Common.isNumber(index)) {
                list.push(en[index]);
            }
        }

        return list;
    }

    static enumSwapped<T extends string|number, TEnumValue>(en: { [key in T]: TEnumValue }, includeKeys?: TEnumValue[], excludedKeys?: TEnumValue[]): { [key: string]: string } {
        const obj: { [key: string]: string } = {};

        for(const index in en) {
            if (excludedKeys && excludedKeys.includes(en[index])) {
                continue;
            }

            if (includeKeys && !includeKeys.includes(en[index])) {
                continue;
            }

            if(!Common.isNumber(index)) {
                const value = en[index] as any;
                obj[index] = value;
            }
        }

        return obj;
    }

    static enumSimplified<T extends string|number, TEnumValue>(en: { [key in T]: TEnumValue }, includeKeys?: TEnumValue[], excludedKeys?: TEnumValue[]): { [key: string]: string } {
        const obj: { [key: string]: string } = {};

        for(const index in en) {
            if (excludedKeys && excludedKeys.includes(en[index])) {
                continue;
            }

            if (includeKeys && !includeKeys.includes(en[index])) {
                continue;
            }

            if(!Common.isNumber(index)) {
                const value = en[index] as any;
                obj[value] = index;
            }
        }

        return obj;
    }

    static enumListToKey<TEnumValue>(en: TEnumValue, list: { key: string, value: TEnumValue }[]) {
        const enumValue = list.filter(l => l.value === en);
        if (enumValue.length === 0) {
            throw new Error(`Out of bounds: ${en}`);
        }
        return enumValue[0].key;
    }

    static enumToKeyMap<T extends string|number, TEnumValue>(en: { [key in T]: TEnumValue }): { [key: string]: string} {
        const map: { [key: string]: string} = {};

        for(const index in en) {
            if(!Common.isNumber(index)) {
                const key = en[index] as any;
                map[key] = Common.camelCaseToWords(index);
            }
        }

        return map;
    }
    
    static toFilename(text: string){
        return text.replace(/[ ,]/g, '_').replace(/[{}:\/\\|?*\"\'><)(]/g, '');
    }

    static toSafeId(text: string) {
        return text ? text.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/ +/g, '-').toLowerCase() : '';
    }

    static parseParamString(url: string) {
        return this.parseStringDelimited(url, ';');
    }

    static parseQueryString(url: string) {
        return this.parseStringDelimited(url, '?');
    }

    static parseUrlString(url: string) {
        return { ...this.parseParamString(url), ...this.parseQueryString(url) };
    }

    static parseStringDelimited(url: string, delimiter: string) {
        const results: { [key: string]: string } = {};
        const str = url.split(delimiter)[1];

        if(str) {
            const qs = str.split('&');
            for(let i = 0, q: string; q = qs[i]; i++) {
                const keyVal = q.split('=');
                results[keyVal[0]] =  keyVal[1];
            }
        }

        return results;
    }

    static getImageFileName(contentType: string) {
        switch(contentType) {
            case 'image/vnd.microsoft.icon':
            case 'image/x-icon':
            case 'image/icon':
                return `image.ico`;
            case 'image/svg+xml':
            case 'image/svg':
                return `image.svg`;
            case 'image/x-png':
            case 'image/png':
                return `image.png`;
            case 'image/jpeg':
            case 'image/pjpeg':
                return `image.jpeg`;
            case 'image/tif':
            case 'image/tiff':
                return `image.tif`;
            case 'image/bmp':
            case 'image/gif':
            case 'image/webp':
                return contentType.replace('/', '.');
            default:
                return '';
        }
    }

    static getContentTypeFromName(file: string, canError: boolean = true) {
        const arr = file.split('.');
        const ext = arr[arr.length - 1].toLowerCase();
        switch (ext) {
            case 'html': return "text/html";
            case 'css': return "text/css";
            case 'js': return "application/javascript";
            case 'png': return "image/png";
            case 'ico': return "image/x-icon";
            case 'jpg':
            case 'jfif':
            case 'jpeg': return "image/jpeg";
            case 'gif': return "image/gif";
            case 'svg': return "image/svg+xml";
            case 'webp': return "image/webp";
            case 'pdf': return "application/pdf";
            case 'json': return "application/json";
            case 'map': return "application/json";
            case 'woff': return "application/font-woff";
            case 'woff2': return "binary/octet-stream";
            case 'txt': return "text/plain";
            case 'csv': return "text/csv";
            case 'xlsx': return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case 'doc': return "application/msword";
            case 'docx': return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case 'mp4': return "video/mp4";
        }

        if (canError){
            throw file + " type not found";
        }
        else {
            return '';
        }
    }

    static isImageType(file: string) {
        const arr = file.split('.');
        const ext = arr[arr.length - 1].toLowerCase();
        switch (ext) {
            case 'png':
            case 'ico':
            case 'jpg':
            case 'jfif':
            case 'jpeg':
            case 'gif':
            case 'svg':
            case 'webp': return true;
            default: return false;
        }
    }

    static stringDistance(str1: string, str2: string, threshold: number = .9) {
        const distance = str1 && str2 ? jaroDistance(str1, str2, { caseSensitive: false }) : 0;
        return { distance: distance, isMatch: distance >= threshold };
    }

    static isGuid(value: string) {    
        const regex = /[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i;
        const match = regex.exec(value);
        return match != null;
    }

    static isMongoId(value: string){
        const regex = /^[a-f\d]{24}$/i;  // This old regex fails for ids which are all numbers  /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i;
        const match = regex.exec(value);
        return match != null;
    }

    static async loadFromMap<T>(map: {[key: string]: T}, ids: string[], lookupFunc: (ids: string[]) => Promise<T[]>, mapIdFunc: (obj: T) => string, batchSize?: number): Promise<T[]> {
        const keys = Object.keys(map);
        const uniqueIds = Common.distinct(ids);
        const missingIds = uniqueIds.filter(id => !keys.includes(id));

        while(missingIds.length > 0){
            const lookupIds = missingIds.splice(0, batchSize || missingIds.length);

            const lookups = await lookupFunc(lookupIds);
            for (const obj of lookups) {
                map[mapIdFunc(obj)] = obj;
            }
        }

        return uniqueIds.map(id => map[id]).filter(v => v !== undefined && v !== null);
    }

    static async requestLoader<T>(map: { [key: string]: Promise<T[]> }, ids: string[], lookupFunc: (ids: string[]) => Promise<T[]>, mapIdFunc: (obj: T) => string): Promise<T[]> {
        const missingIds = ids.filter(id => !map.hasOwnProperty(id));
   
        if (missingIds.length > 0) {
            let promise = lookupFunc(missingIds);
            missingIds.forEach(id => map[id] = promise);
        }

        const promises: Promise<T[]>[] = [];
        ids.forEach(id => promises.push(map[id]));

        const values = await Promise.all(promises);
        const lookupMap: { [key: string]: T } = {};

        values.forEach(v => {
            v.forEach(d => lookupMap[mapIdFunc(d)] = d);
        });
        
        return ids.map(id => lookupMap[id]).filter(v => v !== undefined && v !== null);
    }

    static toMap<T>(array: T[], keyFunc: (value: T, index?: number) => string|number): {[key: string]: T} {
        return array.reduce((pv: any, cv: any, i: number) => {
            pv[keyFunc(cv, i)] = cv;
            return pv;
        }, {});
    }

    static toPropertyMap<T, C>(array: T[], keyFunc: (value: T) => string|number, lookupFunc: (obj: T) => C): {[key: string]: C} {
        return array.reduce((pv: any, cv: any) => {
            pv[keyFunc(cv)] = lookupFunc(cv);
            return pv;
        }, {});
    }

    static hashCode(str: string, numberLength: number = 7){
        if (numberLength === 0){
            return str;
        }
        
        let h = 0;
        for(let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        const output = `${h}`;
        const length = output.length;
        return output.substr(length - (numberLength || 1));
    }

    static hasProtocol(url: string) {
        return url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('mailto:') || url.startsWith('tel:'));
    }

    static arrayToIndex<T>(array: T[], currentIndex: number, direction: -1 | 1): T {
        const toIndex = (currentIndex + direction);
        const count = array.length;
        const wrappedIndex = (toIndex % count + count) % count;
        return array[wrappedIndex];
    }

    static findLastIndex<T>(array: T[], predicate: (value: T, index: number, obj: T[]) => boolean): number {
        let index = array.length;
        while (index--) {
            if (predicate(array[index], index, array))
                return index;
        }
        return -1;
    }

    static textBreak(text: string, maxLength: number, wordBreak: boolean = true, longWordBreak: number = 10) {
        if (wordBreak) {
            const words = text.split(' ');
            let out = '';
            for (let index = 0; index < words.length; index++) {
                const word = words[index];
                const wordOutLength = out.length + word.length;
                if (out.length < maxLength && wordOutLength > maxLength) {
                    const overageLength = (wordOutLength - maxLength);
                    if (overageLength > longWordBreak) {
                        out += word.substring(0, word.length - overageLength).trim();
                        break;
                    }
                    out += word;
                }
                else {
                    out += word;
                }
                if (out.length >= maxLength) {
                    break;
                }
                out += ' ';
            }
            return out.trim();
        }
        else {
            return text.substring(0, maxLength).trim();
        }
    }
}