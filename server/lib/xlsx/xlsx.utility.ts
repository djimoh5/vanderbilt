var XLSX = require('./xlsx.core.min.js');

type columnData = { [columnKey: string]: any };

export class xlsx {
    
    static fileToWorksheet<T extends columnData>(binaryData: string, isBuffer?: boolean): { sheet: { name: string }, headers: string[], data: T[] } {
        return xlsx.fileToWorksheets<T>(binaryData, isBuffer)[0];
    }
    
    static fileToWorksheets<T extends columnData>(fileData: string | Buffer, isBuffer?: boolean): { sheet: { name: string }, headers: string[], data: T[] }[] {
        const workbook = XLSX.read(fileData, { type: isBuffer ? 'buffer': 'binary' });
        const sheets = [];
        for (let index = 0; index < workbook.SheetNames.length; index++) {
            const name = workbook.SheetNames[index];

            const worksheet = workbook.Sheets[name];
    
            const data: T[] = XLSX.utils.sheet_to_json(worksheet);
    
            const columnKeys = Object.keys(data[0]);

            sheets.push({ sheet: { name: name }, headers: columnKeys, data });
        }

        return sheets;
    }

    static fileToRows(fileData: string | Buffer, isBuffer?: boolean): any[][] {
        const workbook = XLSX.read(fileData, { type: isBuffer ? 'buffer' : 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    }

    static getWorkbook(fileBuffer: string) {
        return XLSX.read(fileBuffer, { type: 'buffer' });
    }

    static fileToBuffer(workbook: any) {
        return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    }
}