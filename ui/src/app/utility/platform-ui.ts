export class PlatformUI {
    static canvas: { center: { x: number, y: number } };
    
    goBack() {}
    reload() {}
    open(_path: string = null) { }
    openExternal(_url: string) { }
    url(_path?: string): string { return ''; }
    path(): string { return ''; }
    hash(_hashValue: string = null): string { return ''; }
    queryString(): string { return ''; }
    redirect(_path: string, _event?: MouseEvent) {}
    query(_selector: any): any {}
    download(_href: string, _filename?: string, _style?: string) {}
    
    onResize(_eventNamespace: string, _callback: (size: { width: number, height: number }) => void) {}
    endOnResize(_eventNamespace: string) { }

    onScroll(_eventNamespace: string, _callback: (scrollTop: number) => void) {}
    endOnScroll(_eventNamespace: string) { }

    infiniteScroll(_onMoreResults: Function, _scrollBuffer: number) {}
    endInfiniteScroll() { }

    scrollToTop(_animationTime?: number, _offset?: number) { }
    scrollToElement(_id: string, _animationTime?: number, _offset?: number, _relativeTo?: string) { }
    scrollTop(_scrollElement?: string, _scrollTop?: number, _animationTime?: number) { }
    getScrollTop(): number { return 0; }

    onBlur(_eventNamespace: string, _callback: (activeElem: any) => void) { }
    endOnBlur(_eventNamespace: string) { }

    addDocumentOffClick(_nativeElem: any, _thenDo: Function) { }
    endDocumentOffClick() { }

    createObjectURL(_blob: Blob): string { return ''; }
    revokeObjectURL(_url: string) {}

    getSelection(): Selection { return null; }
    getSelectionText(): string { return ''; }

    setTheme(_enableDarkMode: boolean, _authenticated: boolean) {};

    createDynamicElement(_url: string, _appendTo: 'head' | 'body', _id: string) { return Promise.resolve(true); }
}