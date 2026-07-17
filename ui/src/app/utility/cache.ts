import { GenericMap } from '../../../../model/shared.model';

declare var md5: any;

interface StorageEntry {
    v: any;
    e: number; // expires-at epoch ms, 0 = never expires
}

export class Cache {
    private static memoryCache: GenericMap<any> = {};

	static set(key: string, keyCategory: string, data: any, expirationInSeconds: number, subKey: string = '_', inMemory?: boolean) {
        let encryptedKey = this.getEncryptedKey(key, keyCategory);
        let currentData = inMemory ? this.memoryCache[encryptedKey] : this.readStorage(encryptedKey);

        if(!currentData) {
            currentData = {};
        }

        currentData[md5(subKey || '_')] = data;

        if(inMemory) {
            this.memoryCache[encryptedKey] = currentData;
        }
        else {
            this.writeStorage(encryptedKey, currentData, expirationInSeconds);
        }
	}

    static get(key: string, keyCategory: string, subKey: string = '_', inMemory?: boolean) {
        let encryptedKey = this.getEncryptedKey(key, keyCategory);
        let data = inMemory ? this.memoryCache[encryptedKey] : this.readStorage(encryptedKey);
        return data ? data[md5(subKey || '_')] : undefined;
	}

    static remove(key: string, keyCategory: string = null) {
        let encryptedKey = this.getEncryptedKey(key, keyCategory);
        localStorage.removeItem(encryptedKey);
        delete this.memoryCache[encryptedKey];
	}

    static flush(keyCategory: string = null, expirationThreshold: number = null) {
        if (keyCategory) {
            this.storageKeys().forEach((key: string) => {
                if (key.substring(0, keyCategory.length) === keyCategory &&
                    (!expirationThreshold || this.remainingTTL(key) < (expirationThreshold * 1000))) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            localStorage.clear();
        }

        this.memoryCache = {};
	}

	static size() {
		let total = 0;
        this.storageKeys().forEach(key => total += (key.length + (localStorage.getItem(key) || '').length) * 2);
        return total;
	}

	static free() {
		return (5 * 1024 * 1024) - this.size();
    }

    private static storageKeys(): string[] {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        return keys;
    }

    private static remainingTTL(key: string): number {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return 0;
        }

        try {
            const entry: StorageEntry = JSON.parse(raw);
            return entry.e ? entry.e - Date.now() : Number.MAX_SAFE_INTEGER;
        }
        catch (e) {
            return 0;
        }
    }

    private static readStorage(key: string): any {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return undefined;
        }

        try {
            const entry: StorageEntry = JSON.parse(raw);

            if (entry.e && entry.e < Date.now()) {
                localStorage.removeItem(key);
                return undefined;
            }

            return entry.v;
        }
        catch (e) {
            return undefined;
        }
    }

    private static writeStorage(key: string, data: any, expirationInSeconds: number) {
        const entry: StorageEntry = {
            v: data,
            e: expirationInSeconds ? Date.now() + (expirationInSeconds * 1000) : 0
        };

        localStorage.setItem(key, JSON.stringify(entry));
    }

    private static getEncryptedKey(key: string, keyCategory: string) {
        return keyCategory ? `${keyCategory}${md5(key)}` : md5(key);
    }
}
