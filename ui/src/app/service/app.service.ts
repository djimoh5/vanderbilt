import { Injectable } from '@angular/core';

import { RouteInfo, RouterService, RouteParamsCallback } from './router.service';
//import { ClientSocket } from './client.socket';

import { PlatformUI } from '../utility/platform-ui';

import { EventQueue } from '../../../../event/event-queue';
import { BaseEvent, TypeOfBaseEvent, BaseEventCallback, QueueOperators } from 'bundle/event';

@Injectable()
export class AppService {
    private eventQueue: EventQueue;

    private componentLoaded: boolean; // denotes when at least one component has loaded after routing
    protected get ServiceComponentId() { return 'service'; }

    constructor(public routerService: RouterService, private platformUI: PlatformUI/*, public clientSocket: ClientSocket*/) {
        this.eventQueue = new EventQueue();

        /*this.clientSocket.on(Config.ServerEventQueueId, (event: BaseEvent<any>) => {
            this.notify(event, true);
        });

        this.routerService.subscribeToNavigationStart(() => {
            this.componentLoaded = false;
            this.notify(new RouterLoadingEvent(true));
        });

        this.routerService.subscribeToUrl(() => {
            this.notify(new RouterLoadingEvent(false));
        });*/
    }

    setComponentLoaded() {
        if (!this.componentLoaded) {
            this.componentLoaded = true;
            //this.notify(new RouterLoadingEvent(false));
        }
    }

    navigate(route: RouteInfo, params: {} = null, event: MouseEvent = null, queryParams: {} = {}) {
        this.routerService.navigate(route, params, event, queryParams);
        this.platformUI.scrollToTop();
    }

    open(route: RouteInfo, params: {} = null) {
        this.routerService.open(route, params);
    }

    getLinkUrl(route: RouteInfo, params: {} = null, relativeToBase: boolean = false) {
        return this.routerService.getLinkUrl(route, params, relativeToBase);
    }

    subscribeToParams(componentId: number, callback: RouteParamsCallback) {
        this.routerService.subscribeToParams(componentId, callback);
    }

    subscribeToQueryParams(componentId: number, callback: RouteParamsCallback) {
        this.routerService.subscribeToQueryParams(componentId, callback);
    }

    unsubscribeToParams(componentId: number) {
        this.routerService.unsubsribeToParams(componentId);
    }

    unsubscribeToQueryParams(componentId: number) {
        this.routerService.unsubsribeToQueryParams(componentId);
    }

    subscribe<T extends BaseEvent<any>>(eventType: TypeOfBaseEvent<T>, componentId: number | string, callback: BaseEventCallback<T>, operators?: QueueOperators<T>) {
        this.eventQueue.subscribe(eventType, componentId, '' + componentId, callback, operators);
    }

    notify(event: BaseEvent<any>, _fromServer: boolean = false) {
        this.eventQueue.notify(event);

        /*if (!fromServer && event.isSocketEvent) {
            this.clientSocket.emit(Config.ClientEventQueueId, event);
        }*/
    }

    unsubscribe(componentId: number | string, eventType?: typeof BaseEvent) {
        this.eventQueue.unsubscribe(componentId, eventType);
    }
}
