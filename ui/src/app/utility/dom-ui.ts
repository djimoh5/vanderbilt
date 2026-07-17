//TODO: import jQuery and move ALL app usage of it to this class!
declare var window: any, document: Document, $:any;

import { Injectable, NgZone } from '@angular/core';
import { Config } from '../config/config';
import { Common } from './common';
import { PlatformUI } from './platform-ui';

@Injectable()
export class DomUI implements PlatformUI {
    constructor(private ngZone: NgZone) {

    }

    goBack() {
        window.history.back();
    }

    reload() {
        window.location.reload();
    }

    open(path: string = null) {
        window.open(Config.BaseUrl + this.pathValue(path), '_blank');
    }

    openExternal(url: string) {
        if(!Common.hasProtocol(url)) {
            url = 'https://' + url;
        }

        window.open(url, '_blank');
    }

    url(path?: string): string {
        return path? `${window.location.origin}${this.pathValue(path)}` : window.location.href;
    }

    path(): string {
        return window.location.pathname;
    }

    hash(hashValue: string = null): string {
        if(hashValue !== null) {
            window.location.hash = hashValue;
        }

        return window.location.hash;
    }

    queryString(): string {
        return window.location.search;
    }

    private pathValue(path: string) {
        return path ? (path.substring(0, 1) === '/' ? path : `/${path}`) : '';
    }
    
    redirect(path: string = '', event?: MouseEvent) {
        if(!Common.hasProtocol(path)) {
            path = Config.BaseUrl + (path.substring(0, 1) === '/' ? path : `/${path}`);
        }

        if (!event || !(event.shiftKey || event.ctrlKey)) {
            if(window.top !== window.self) {
                window.top.location.href = path;
            }
            else {
                window.location.href = path;
            }
        }
        else {
            window.open(path, '_blank');
        }
    }
    
    query(selector: any): any {
        return $(selector);
    }

    download(href: string, filename: string, style?: string){
        var link = document.createElement('a');
        link.setAttribute('href', href);
        link.setAttribute('target', '_blank');
        
        if (filename){
            link.setAttribute('download', filename);
        }
        if (style){
            link.setAttribute('style', style);
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    onResize(eventNamespace: string, callback: (size: { width: number, height: number }) => void) {
        $(window).off('resize.' + eventNamespace);
        $(window).on('resize.' + eventNamespace, () => {
            callback({ width: $(window).width(), height: $(window).height() });
        });
        
        callback({ width: $(window).width(), height: $(window).height() });
    }

    endOnResize(eventNamespace: string) {
        $(window).off('resize.' + eventNamespace);
    }

    onScroll(eventNamespace: string, callback: (scrollTop: number) => void) {
        $(window).off('scroll.' + eventNamespace);

        this.ngZone.runOutsideAngular(() => {
            $(window).on('scroll.' + eventNamespace, () => {
                callback($(window).scrollTop());
            });
        });

        callback($(window).scrollTop());
    }

    endOnScroll(eventNamespace: string) {
        $(window).off('scroll.' + eventNamespace);
    }
    
	infiniteScroll(onMoreResults: Function, scrollBuffer: number) {
        var lastScrollTop: number = 0;
        $(window).off('scroll.paging');

        this.ngZone.runOutsideAngular(() => {
            $(window).on('scroll.paging', () => {
                var scrollTop = $(window).height() + $(window).scrollTop();
                var documentHeight = $(document).height();
            
                if(scrollTop > (lastScrollTop && scrollBuffer) && scrollTop >= documentHeight) {
                    lastScrollTop = scrollTop;
                    onMoreResults();
                }
            });
        });
    }
    
    endInfiniteScroll() {
        $(window).off('scroll.paging');
    }

    onBlur(eventNamespace: string, callback: (activeElem: any) => void) {
        $(window).off('blur.' + eventNamespace);
        $(window).on('blur.' + eventNamespace, () => {
            callback(document.activeElement);
        });
    }

    endOnBlur(eventNamespace: string) {
        $(window).off('blur.' + eventNamespace);
    }

    addDocumentOffClick(nativeElem: any, thenDo: Function) {
        var container = $(nativeElem);
        $(document).on('mouseup.menu-offclick', (e: any) => {
            if (!container.is(e.target) && container.has(e.target).length === 0) {
                thenDo();
            }
        });
    }

    endDocumentOffClick() {
        $(document).off('mouseup.menu-offclick');
    }

    scrollToTop(animationTime?:number, offset?: number) {
        window.scrollTo({ top: offset || 0, behavior: animationTime ? 'smooth' : 'auto' });
    }

    getScrollTop(): number {
        return $('html,body').scrollTop();
    }

    scrollToElement(id: string, animationTime?: number, offset: number = 0, relativeTo: string = 'html,body') {
        let el = document.getElementById(id);

        if (el != null) {
            var top = el.offsetTop;
            // const relativeElement = document.querySelector(relativeTo);
            // const clientTop = relativeElement.getBoundingClientRect().top;
            const scrollTop = (top + offset); // - clientTop;

            if(animationTime) {
                $(relativeTo).animate({ scrollTop: scrollTop }, animationTime);
            }
            else {
                $(relativeTo).scrollTop(scrollTop);
            }
        }
    }

    scrollTop(scrollElement?: string, scrollTop?: number, animationTime?: number) {
        const el = $(scrollElement);
        if (el && el[0]){
            if(animationTime) {
                el.animate({ scrollTop: scrollTop }, animationTime);
            }
            else {
                el.scrollTop(scrollTop);
            }
        }
        
    }

    createObjectURL(blob: Blob) {
        return window.URL.createObjectURL(blob);
    }
    
    revokeObjectURL(url: string) {
        return window.URL.revokeObjectURL(url);
    }

    getSelection() {
        return window.getSelection();
    }

    getSelectionText() {
        return window.getSelection()?.toString();
    }

    setTheme(enableDarkMode: boolean, authenticated: boolean) {
        if(!authenticated || enableDarkMode) {
			this.query('body').removeClass('light-theme');
			this.query('body').addClass('dark-theme');
		}
		else if(!enableDarkMode) {
			this.query('body').removeClass('dark-theme');
			this.query('body').addClass('light-theme');
		}

        if(authenticated) {
            this.query('body').removeClass('unauthenticated');
            this.query('body').addClass('authenticated');
        }
        else {
            this.query('body').removeClass('authenticated');
            this.query('body').addClass('unauthenticated');
        }
    }

    createDynamicElement(url: string, appendTo: 'head' | 'body', id: string): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const existingElement = document.getElementById(id);
            if (existingElement){
                resolve(true);
                return;
            }

            const appendToElement = document.getElementsByTagName(appendTo)[0];
    
            const createdElement = document.createElement('script');
            createdElement.type = 'text/javascript';
            createdElement.src = url;

            if (id) {
                createdElement.id = id;
            }
    
            if ((<any>createdElement).readyState) {  //IE
                (<any>createdElement).onreadystatechange = () => {
                    if ((<any>createdElement).readyState === 'loaded' || (<any>createdElement).readyState === 'complete') {
                        (<any>createdElement).onreadystatechange = null;
                        resolve(true);
                    }
                };
            } else {  //Others
                createdElement.onload = () => {
                    resolve(true);
                };
            }
            appendToElement.appendChild(createdElement);
            
            createdElement.onerror = () => {
                createdElement.remove();
                resolve(false);
            };
        });
    }
}