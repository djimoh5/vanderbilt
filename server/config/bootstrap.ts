import 'core-js/es7/reflect';
import { ReflectiveInjector, Provider, InjectionToken } from 'injection-js';
import { DeployConfig } from './deploy.config';
export { Injectable } from 'injection-js';

export function Bootstrap(injectionToken: InjectionToken<any> = null) {
    return (target) => {
        if(!Injector.disabledAutoBootstrap) {
            if(injectionToken) {
                const provider: Provider = {
                    multi: true,
                    provide: injectionToken,
                    useClass: target
                };

                Injector.add(provider);
            }
            else {
                Injector.add(target);
            }
        }
    };
}

export class Injector {
    private static injector: { [tenantId: string]: ReflectiveInjector } = {};
    private static injectables: any[] = [];
    static disabledAutoBootstrap: boolean = false;

    static add(cls: any) {
        this.injectables.push(cls);
    }

    static get<T>(cls: { new(...args: any): T; }, tenantId?: string): T {
        if(!tenantId) {
            tenantId = '';
        }
        
        if(!this.injector[tenantId]) {
            this.injector[tenantId] = ReflectiveInjector.resolveAndCreate(this.injectables);
        }

        DeployConfig.INJECTED_TENANT_ID = tenantId;
        return this.injector[tenantId].get(cls);
    }
}
