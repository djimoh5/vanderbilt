export class MongoSanitizer {
    static sanitizeInput(value: any): any {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(i => MongoSanitizer.sanitizeInput(i));
        if (typeof value === 'object' && !(value instanceof Date) && !(value instanceof Buffer)) {
            const out: Record<string, any> = {};
            for (const key of Object.keys(value)) {
                if (!key.startsWith('$')) {
                    out[key] = MongoSanitizer.sanitizeInput(value[key]);
                }
            }
            return out;
        }
        return value;
    }

    // Removes $where from queries at the DB layer to prevent JS injection as a backstop
    static blockDangerousOperators(query: any): void {
        if (!query || typeof query !== 'object') return;
        for (const key of Object.keys(query)) {
            if (key === '$where') {
                delete query[key];
            } else if (query[key] && typeof query[key] === 'object') {
                MongoSanitizer.blockDangerousOperators(query[key]);
            }
        }
    }
}
