const config = require("config");
const sdk = require("matrix-js-sdk");
const AliasHandler = require("./src/AliasHandler");
const matrixUtils = require("matrix-js-snippets");

const client = sdk.createClient({
    baseUrl: config['homeserverUrl'],
    accessToken: config['accessToken'],
    userId: config['userId']
});

matrixUtils.autoAcceptInvites(client);
AliasHandler.start(client);

client.startClient({initialSyncLimit: 3});