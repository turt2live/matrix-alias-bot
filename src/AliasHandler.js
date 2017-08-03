const LogService = require("./LogService");
const config = require("config");
const wildcard = require("node-wildcard");

class AliasHandler {

    constructor() {
        this._aliasDomain = config['aliasDomain'];
        this._allowedWildcards = config['allowedAliases'];
        this._adminUsers = config['adminUsers'];
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
        var message = event.getContent().body;
        if (!message.startsWith("!alias")) return;

        LogService.verbose("AliasHandler", "Processing command from " + event.getSender() + " in room " + event.getRoomId() + ": " + message);

        var args = message.substring("!alias ".length).trim().split(" ");
        if (args.length <= 0 || args[0] === "help") {
            this._client.sendNotice(event.getRoomId(), "" +
                "Alias bot help:\n" +
                "!alias #mycoolalias   - Adds an alias on " + this._aliasDomain + "\n" +
                "!alias allowed        - Lists the allowed alias formats\n" +
                "!alias help           - This menu\n\n" +
                "Head over to #alias:t2bot.io for help or more information.");
        } else if (args[0] === "allowed") {
            if (this._allowedWildcards.length <= 0) this._client.sendNotice(event.getRoomId(), "The administrator has not allowed any wildcard aliases.");
            else this._client.sendNotice(event.getRoomId(), "The following alias wildcards are allowed:\n" + this._allowedWildcards.join("\n"));
        } else if (args[0].startsWith("#")) {
            if (!this._hasPermission(event.getSender(), event.getRoomId())) {
                LogService.warn("AliasHandler", event.getSender() + " tried to use command `" + message + "` in room " + event.getRoomId() + " without permission");
                this._client.sendNotice(event.getRoomId(), "You must be able to configure the room to add an alias.");
                return;
            }

            var desiredAlias = args[0];
            if (!desiredAlias.endsWith(":" + this._aliasDomain))
                desiredAlias = desiredAlias + ":" + this._aliasDomain;

            var allowed = this._adminUsers.indexOf(event.getSender()) !== -1;
            if (!allowed) {
                for (var wildcardOption of this._allowedWildcards) {
                    if (wildcard(desiredAlias, wildcardOption)) {
                        allowed = true;
                        break;
                    }
                }
            }

            if (!allowed) {
                LogService.warn("AliasHandler", event.getSender() + " tried to add a disallowed alias in room " + event.getRoomId() + ": " + desiredAlias);
                this._client.sendNotice(event.getRoomId(), "That alias is not allowed. See !alias allowed for the allowed aliases");
            } else {
                this._client.createAlias(desiredAlias, event.getRoomId()).then(() => {
                    LogService.info("AliasHandler", "User " + event.getSender() + " added alias " + desiredAlias + " to room " + event.getRoomId());
                    this._client.sendNotice(event.getRoomId(), "The alias " + desiredAlias + " has been added to the room");
                }).catch(error => {
                    LogService.error("AliasHandler", "Could not add alias " + desiredAlias + " to room " + event.getRoomId() + " as requested by " + event.getSender());
                    LogService.error("AliasHandler", error);
                    if (error.message == "Room alias must be local") {
                        this._client.sendNotice(event.getRoomId(), "The room alias is invalid.");
                    } else if (error.message == "Room alias " + desiredAlias + " already exists") {
                        this._client.sendNotice(event.getRoomId(), "The room alias is already in use by another room");
                    } else {
                        this._client.sendNotice(event.getRoomId(), "There was an error processing your command");
                    }
                });
            }
        } else {
            this._client.sendNotice(event.getRoomId(), "Unknown command. Try !alias help");
        }
    }

    _hasPermission(sender, roomId) {
        var room = this._client.getRoom(roomId);
        var powerLevels = room.currentState.getStateEvents('m.room.power_levels', '');
        if (!powerLevels) return false;
        powerLevels = powerLevels.getContent();

        var userPowerLevels = powerLevels['users'] || {};
        var eventPowerLevels = powerLevels['events'] || {};

        var powerLevel = userPowerLevels[sender];
        if (!powerLevel) powerLevel = powerLevels['users_default'];
        if (!powerLevel) powerLevel = 0; // default

        var eventPowerLevel = eventPowerLevels["m.room.aliases"];
        if (!eventPowerLevel) eventPowerLevel = powerLevels["state_default"];
        if (!eventPowerLevel) return false;

        return eventPowerLevel <= powerLevel;
    }
}

module.exports = new AliasHandler();