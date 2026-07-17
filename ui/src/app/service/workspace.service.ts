import { Injectable } from '@angular/core';

import { AppService } from './app.service';
import { PropertyService } from './property.service';

import { Property } from 'bundle/model';
import { WorkspaceChangedEvent } from 'bundle/event';
import { toPeriod, lastCalendarMonth } from 'bundle/utility';

const STORAGE_KEY_PROPERTY = 'workspace.propertyId';
const STORAGE_KEY_PERIOD = 'workspace.period';

@Injectable()
export class WorkspaceService {
    properties: Property[] = [];

    private _propertyId = '';
    private _month: number | null = null;
    private _year: number | null = null;

    private readyPromise: Promise<void>;

    constructor(private appService: AppService, private propertyService: PropertyService) { }

    get currentPropertyId(): string { return this._propertyId; }
    get currentMonth(): number | null { return this._month; }
    get currentYear(): number | null { return this._year; }
    get currentPeriod(): string { return toPeriod(this._month, this._year); }

    ready(): Promise<void> {
        if (!this.readyPromise) {
            this.readyPromise = this.init();
        }
        return this.readyPromise;
    }

    private async init(): Promise<void> {
        await this.fetchProperties();

        const storedPropertyId = localStorage.getItem(STORAGE_KEY_PROPERTY);
        this._propertyId = storedPropertyId && this.properties.some(p => p.oid === storedPropertyId)
            ? storedPropertyId
            : (this.properties.length > 0 ? this.properties[0].oid as string : '');

        const storedPeriod = this.readStoredPeriod();
        if (storedPeriod) {
            this._month = storedPeriod.month;
            this._year = storedPeriod.year;
        } else {
            const fallback = lastCalendarMonth();
            this._month = fallback.month;
            this._year = fallback.year;
        }
    }

    private readStoredPeriod(): { month: number; year: number } | null {
        const raw = localStorage.getItem(STORAGE_KEY_PERIOD);
        if (!raw) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.month === 'number' && typeof parsed.year === 'number') {
                return parsed;
            }
        } catch { }
        return null;
    }

    async refreshProperties(): Promise<void> {
        await this.fetchProperties();

        if (!this.properties.some(p => p.oid === this._propertyId)) {
            this._propertyId = this.properties.length > 0 ? this.properties[0].oid as string : '';
        }

        this.notifyChanged();
    }

    private async fetchProperties(): Promise<void> {
        const res = await this.propertyService.getAll();
        this.properties = res.success ? res.data : [];
    }

    setProperty(propertyId: string) {
        if (propertyId === this._propertyId) {
            return;
        }

        this._propertyId = propertyId;
        localStorage.setItem(STORAGE_KEY_PROPERTY, propertyId);
        this.notifyChanged();
    }

    setPeriod(month: number, year: number) {
        if (month === this._month && year === this._year) {
            return;
        }

        this._month = month;
        this._year = year;
        localStorage.setItem(STORAGE_KEY_PERIOD, JSON.stringify({ month, year }));
        this.notifyChanged();
    }

    private notifyChanged() {
        this.appService.notify(new WorkspaceChangedEvent({ propertyId: this._propertyId, period: this.currentPeriod }));
    }
}
