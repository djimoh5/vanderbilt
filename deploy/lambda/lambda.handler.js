const serverless = require('serverless-http')
const Database = require('../server/database/database').Database;

module.exports = function (app) { //express app
    const handler = serverless(app);

    return async function (event, context) {
        if (!Database.getMongo()) {
            await Database.open();
        }

        return handler(event, context);
    };
};