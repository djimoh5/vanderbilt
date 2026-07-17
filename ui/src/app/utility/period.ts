export interface MonthOption { value: number; label: string; }

export const Months: MonthOption[] = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

export const Years: number[] = Array.from({ length: 2050 - 2010 + 1 }, (_, i) => 2010 + i);

export function toPeriod(month: number, year: number): string {
    if (!month || !year) {
        return '';
    }
    return `${year}-${String(month).padStart(2, '0')}`;
}

export function lastCalendarMonth(): { month: number; year: number } {
    const now = new Date();
    const month = now.getMonth(); // 0-based; getMonth()-1+1 = getMonth() gives previous month's 1-based value
    if (month === 0) {
        return { month: 12, year: now.getFullYear() - 1 };
    }
    return { month, year: now.getFullYear() };
}
