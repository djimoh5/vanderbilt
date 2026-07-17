import { BaseEvent, TypeOfBaseEvent, BaseEventCallback, QueueOperators } from './event.model';

import { Observable, Observer, Subscription, Subject } from 'rxjs';
import { filter, share } from 'rxjs/operators';

export class EventQueue {
    protected events: { [key: string]: Observable<BaseEvent<any>> } = {};
    protected activators: { [key: string]: Subject<BaseEvent<any>> } = {};
    protected subscribers: { [key: string]: { [key: string]: Subscription[] } } = {};

    constructor() {
    }
    
    subscribe<T extends BaseEvent<any>>(eventType: TypeOfBaseEvent<T>, subscriberId: number | string, subscriberName: string, callback: BaseEventCallback<T>, operators?: QueueOperators<T>) : Observable<T> {
        if(!eventType['eventName']) {
            throw('The event does not have a name. Please remember to annotate your event with @AppEvent.');    
        }
        
        const eventName = eventType['eventName'];
        let observable: Observable<any>;
        
        if (!this.events[eventName]) {
            this.events[eventName] = observable = Observable.create((observer: Observer<T>) => {
                if(!this.activators[eventName]) {
                    this.activators[eventName] = <any>(new Subject<T>());
                }
                
                this.activators[eventName].subscribe(<any>observer);
            });
            
            observable = observable.pipe(share());
            this.subscribers[eventName] = {};
        }
        else {
            observable = this.events[eventName];
        }
        
        if (!this.subscribers[eventName][subscriberId]) {
            this.subscribers[eventName][subscriberId] = [];
        }

        if(operators) {
            for(const key in operators) {
                switch (key) {
                    case 'filter': observable = observable.pipe(filter(operators[key]));
                        break;
                }
            }
        }
        
        this.subscribers[eventName][subscriberId].push(observable.subscribe(event => {
            try {
                callback(event);
            }
            catch(e: any) {
                throw { name: 'EventQueueError', message: `Unable to process ${eventName}. ${(e && e.message) || ''}`, innerException: e, event: event, eventName: eventName, subscriberId: subscriberId, subscriberName: subscriberName, eventType: eventType } as Error;
            }
        }));

        return observable;
    }
    
    unsubscribe<T extends BaseEvent<any>>(subscriberId: any, eventType?: TypeOfBaseEvent<T>) {
        if(eventType) {
            if(this.subscribers[eventType['eventName']] && this.subscribers[eventType['eventName']][subscriberId]) {
                this.unsubscribeObservable(subscriberId, eventType['eventName']);
            }
        }
        else {
            for(const name in this.subscribers) {
                if(this.subscribers[name][subscriberId]) {
                    this.unsubscribeObservable(subscriberId, name);
                }
            }
        }
    }
    
    private unsubscribeObservable(subscriberId: any, eventName: string) {
        this.subscribers[eventName][subscriberId].forEach(subscription => {
            subscription.unsubscribe();    
        });
        
        delete this.subscribers[eventName][subscriberId];
    }

    notify(event: BaseEvent<any>) {
        const eventName = event.eventName;

        if (this.activators[eventName]) {
            setTimeout(() => {
                this.activators[eventName].next(event);
            });
        }
    }
    
    clearEvent(eventName: string) {
        if (this.events[eventName]) {
            delete this.events[eventName];
            for(const name in this.activators) {
                this.activators[name].complete();
            }
            
            for(const name in this.subscribers) {
                for(const subscriberId in this.subscribers[name]) {
                    this.subscribers[name][subscriberId].forEach(subscriber => {
                       subscriber.unsubscribe(); 
                    });

                    delete this.subscribers[name][subscriberId];
                }
            }
        }
    }
}