import { OnDestroy, Component } from '@angular/core';
import { AppService, RouteParamsCallback } from 'bundle/service';
import { BaseEvent, TypeOfBaseEvent, BaseEventCallback, QueueOperators } from 'bundle/event';

//import { BaseTrackEventDirective } from 'bundle/directive';

@Component({
    selector: 'app-base-component',
    template: '<div><div>'
})
export abstract class BaseComponent implements OnDestroy {
    private _componentId: number;
    get componentId(): number { return this._componentId; }
    static nextComponentId: number = 0;

    constructor(protected appService: AppService) {

        if (this.appService) {
            this.appService.setComponentLoaded();
        }

        this._componentId = ++BaseComponent.nextComponentId;
    }

    /*protected track(componentName: string){
        BaseTrackEventDirective.track(AnalyticsEventCategory.component, AnalyticsEventAction.view, componentName);
    }*/

    subscribeEvent<T extends BaseEvent<any>>(eventType: TypeOfBaseEvent<T>, callback: BaseEventCallback<T>, operators?: QueueOperators<T>) {
        this.appService.subscribe(eventType, this.componentId, callback, operators);
    }

    unsubscribeEvent<T extends BaseEvent<any>>(eventType: TypeOfBaseEvent<T>) {
        this.appService.unsubscribe(this.componentId, <any>eventType);
    }

    subscribeParams(callback: RouteParamsCallback) {
        this.appService.subscribeToParams(this.componentId, callback);
    }

    subscribeQueryParams(callback: RouteParamsCallback) {
        this.appService.subscribeToQueryParams(this.componentId, callback);
    }

    ngOnDestroy() {
        if(this.appService) {
            this.appService.unsubscribe(this.componentId);
            this.appService.unsubscribeToParams(this.componentId);
            this.appService.unsubscribeToQueryParams(this.componentId);
        }
    }
}