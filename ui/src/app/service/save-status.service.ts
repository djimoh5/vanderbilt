import { Injectable, signal } from '@angular/core';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Provide this per-component (not root) for any page/section that auto-saves -
// each consumer gets its own independent status rather than sharing one app-wide flag.
@Injectable()
export class SaveStatusService {
    private readonly _state = signal<SaveState>('idle');
    readonly state = this._state.asReadonly();

    private resetTimer: ReturnType<typeof setTimeout>;

    start() {
        clearTimeout(this.resetTimer);
        this._state.set('saving');
    }

    success() {
        clearTimeout(this.resetTimer);
        this._state.set('saved');
        this.resetTimer = setTimeout(() => this._state.set('idle'), 2000);
    }

    fail() {
        clearTimeout(this.resetTimer);
        this._state.set('error');
        this.resetTimer = setTimeout(() => this._state.set('idle'), 3000);
    }
}
