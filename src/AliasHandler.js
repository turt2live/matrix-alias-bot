const LogService = require("./LogService");

class AliasHandler {

    constructor() {
    }

    start(client) {
        this._client = client;

        client.on('event', event => {
            if (event.getStateKey() === this._client.credentials.userId) return;
            if (event.getSender() === this._client.credentials.userId) return;
            if (event.getType() !== "m.room.message") return;

            this._tryProcessAliasCommand(event);
        });
    }

    _tryProcessAliasCommand(event) {

    }
}

module.exports = new AliasHandler();