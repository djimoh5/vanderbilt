export function AppEvent(name: string) {
    return function (target: any) {
        target.eventName = name;
    };
}

export function SocketEvent(name: string) {
    return function (target: any) {
        target.eventName = name;
        target.isSocketEvent = true;
    };
}

export class BaseEvent<T> {
    static eventName: string;
    static isSocketEvent: boolean;

    eventName: string;
    isSocketEvent: boolean;
    data: T;
    
    userId: string; //sender userId
    date: number;
    senderId: string;
    created: number;
    platformId?: number;
    
    constructor(data: T, userId?: string, date: number = null) {
        this.data = data;
        this.userId = userId;
        this.date = date !== null ? date : Date.now();
        this.eventName = (<typeof BaseEvent> this.constructor).eventName;
        this.isSocketEvent = (<typeof BaseEvent> this.constructor).isSocketEvent;

        this.created = Date.now();
    }
}

export declare type TypeOfBaseEvent<T extends BaseEvent<any>> = { new(data: any, userId?: string): T; };

export interface BaseEventCallback<T extends BaseEvent<any>> {
    (event: T);
}

export class AlertMessage {
    message: string;
    duration?: number;

    type?: AlertType = AlertType.Info;

    static Info(message, duration = 10000): AlertMessage {
        console.log("Event Info:", message);
        return { message: message, duration: duration, type: AlertType.Info }
    }

    static Warning(message, duration = 10000): AlertMessage {
        console.warn("Event Warning:", message);
        return { message: message, duration: duration, type: AlertType.Warning }
    }
    static Error(message, duration = 10000): AlertMessage {
        console.error("Event Error:", message);
        return { message: message, duration: duration, type: AlertType.Error }
    }
}

export enum AlertType {
    Info,
    Warning,
    Error
}

export class QueueOperators<T extends BaseEvent<any>> {
    filter: (value: T, index: number) => boolean;
}