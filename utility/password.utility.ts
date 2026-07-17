export class PasswordUtility {
    static SPECIAL = "!@#$%,-+*(){}/_&";
    static MIN_PASSWORD_LENGTH = 8;

    static isPasswordSecure(password: string, minPasswordLength: number = PasswordUtility.MIN_PASSWORD_LENGTH) {
        return password && PasswordUtility.insecurePasswordMessage(password, minPasswordLength) === null;
    }

    static insecurePasswordMessage(password: string, minPasswordLength: number = PasswordUtility.MIN_PASSWORD_LENGTH) {
        if(password) {
            if(password.length < minPasswordLength) {
                return 'password must be at least 8 chars long';
            }

            if(password.toLowerCase() === password) {
                return 'password must contain at least one upper case letter';
            }

            if(!password.match(/[0-9]/)) {
                return 'password must contain at least one number';
            }

            if(!PasswordUtility.SPECIAL.split('').some(k => password.includes(k))) {
                return `password must contain at least one symbol (${PasswordUtility.SPECIAL})`;
            }
        }

        return null;
    }

    static generatePassword(passwordLen: number, minPasswordLength: number = PasswordUtility.MIN_PASSWORD_LENGTH) {
        if(passwordLen < minPasswordLength) {
            throw 'password length must be at least 8 chars';
        }

        const special = PasswordUtility.SPECIAL;
        const upperAlpha = "QWERTYUIOPASDFGHJKLZXCVBNM";
        const numbers = "1234567890";
	    const alpha = "qwertyuiopasdfghjklzxcvbnm";
	    let password = "";

	    for(let i = 0; i < passwordLen; i++) {
	        if(i % 4 == 0) {
	        	password += upperAlpha[Math.round(Math.random() * (upperAlpha.length - 1))];
            }
	        if(i % 5 == 0) {
	        	password += numbers[Math.round(Math.random() * (numbers.length - 1))];
            }
	        if(i % 6 == 0) {
	        	password += special[Math.round(Math.random() * (special.length - 1))];
            }
			else {
			    password += alpha[Math.round(Math.random() * (alpha.length - 1))];
            }
	    }
	
		return password + 'X$'; //to satisfy password requirements
    }
}