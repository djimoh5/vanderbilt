import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';

import { BrowserModule, Title } from '@angular/platform-browser';
import { ServiceModule } from './service/service.module';

import { routes } from './app.routes';
import { PlatformUI } from './utility/platform-ui';
import { DomUI } from './utility/dom-ui';
import { AppExceptionHandler } from './utility/exception-handler';

import { routing } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    Title,
    { provide: PlatformUI, useClass: DomUI },
    { provide: ErrorHandler, useClass: AppExceptionHandler },
    importProvidersFrom(
      routing,
      BrowserModule,
      ServiceModule
    ),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
