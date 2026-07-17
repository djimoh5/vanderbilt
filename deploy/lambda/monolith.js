const handler = require('./lambda.handler');
const server = require('../server/monolith.app').server;

module.exports.handler = handler(server.getApp());