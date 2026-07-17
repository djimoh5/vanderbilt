import { ErrorHandler, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Config } from '../config/config';

declare let $;

@Injectable()
export class AppExceptionHandler extends ErrorHandler {
    constructor(private snackBar: MatSnackBar) {
        super();
    }

    override handleError(error: Error) {
        try {
            const exceptionStr = error + '';

            if (exceptionStr === 'EXCEPTION: TypeError: Permission denied') { //ignore permission denied (IE)
                return;
            }

            if(exceptionStr && exceptionStr.indexOf('Transport destroyed') >= 0) {
                return;
            }

            if (exceptionStr === "TypeError: Cannot read properties of null (reading 'postMessage')") { //ignore third-party iframe errors
                return;
            }

            if (exceptionStr === "chrome-extension://") { //ignore chrome extension errors
                return;
            }

            Config.AppCrashed = <any>error;

            
            this.snackBar.open(exceptionStr, 'close', { //Config.ShowErrors ? exceptionStr : 'an unexpected error has occurred'
                duration: 30000,
                verticalPosition: 'top'
            });
        } catch (e) { }

        super.handleError(error);
    }
}
