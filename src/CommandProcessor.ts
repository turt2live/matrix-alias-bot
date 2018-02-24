import { MatrixClient } from "matrix-bot-sdk";
import config from "./config";
import { LogService } from "matrix-js-snippets";
import striptags = require("striptags");
import wildcard = require("node-wildcard");

export class CommandProcessor {
    constructor(private client: MatrixClient) {
    }

    public tryCommand(roomId: string, event: any): Promise<any> {
        const message = event['content']['body'];
        if (!message || !message.startsWith("!alias")) return;

        let command = "help";
        const args = message.substring("!alias".length).trim().split(" ");
        if (args.length > 0) {
            command = args[0];
            args.splice(0, 1);
        }

        if (command === "allowed") {
            const htmlMessage = "<p>The following alias wildcards are allowed<br /><ul>" +
                "<li><code>" + config.allowedAliases.join("</code></li><li><code>") + "</code></li>" +
                "</ul></p>";
            return this.client.sendMessage(roomId, {
                msgtype: "m.notice",
                body: striptags(htmlMessage),
                format: "org.matrix.custom.html",
                formatted_body: htmlMessage,
            });
        } else if (command === "remove" || command === "add") {
            if (args.length < 1) {
                return this.client.sendNotice(roomId, "Please provide a room alias. For help, say !alias help");
            }

            return this.doAddRemoveAlias(roomId, event['sender'], args[0], command === "add");
        } else if (command[0] === "#") {
            return this.doAddRemoveAlias(roomId, event['sender'], command, true);
        } else {
            const htmlMessage = "<p>Alias bot help:<br /><pre><code>" +
                `!alias #mycoolalias          - Adds an alias on ${config.aliasDomain}\n` +
                "!alias allowed               - Lists the allowed alias formats\n" +
                "!alias remove &lt;alias&gt;        - Removes the given alias from the room\n" +
                //`!alias publish               - Publishes this room on the room directory for ${config.aliasDomain}\n` +
                //`!alias unpublish             - Removes this room from the room directory for ${config.aliasDomain}\n` +
                "!alias help                  - This menu\n" +
                "</code></pre></p>" +
                "<p>For help or more information, visit <a href='https://matrix.to/#/#help:t2bot.io'>#help:t2bot.io</a></p>";
            return this.client.sendMessage(roomId, {
                msgtype: "m.notice",
                body: striptags(htmlMessage),
                format: "org.matrix.custom.html",
                formatted_body: htmlMessage,
            });
        }
    }

    private async doAddRemoveAlias(roomId: string, sender: string, alias: string, isAdding: boolean) {
        const isAdmin = config.adminUsers.indexOf(sender) !== -1;

        const hasPermission = await this.hasPermission(roomId, sender);
        if (!hasPermission && !isAdmin) {
            return this.client.sendNotice(roomId, "You do not have permission to run that command in this room.");
        }

        let desiredAlias = alias;
        if (!desiredAlias.endsWith(":" + config.aliasDomain))
            desiredAlias = desiredAlias + ":" + config.aliasDomain;

        if (!isAdmin) {
            let allowed = false;
            for (const option of config.allowedAliases) {
                if (wildcard(desiredAlias, option)) {
                    allowed = true;
                    break;
                }
            }

            if (!allowed) {
                return this.client.sendNotice(roomId, "The alias '" + desiredAlias + "' is not allowed.");
            }
        }

        let aliasPromise: Promise<any> = null;
        if (isAdding) {
            aliasPromise = this.client.createRoomAlias(desiredAlias, roomId).then(() => {
                return this.client.sendNotice(roomId, "The room alias has been added!");
            });
        } else {
            const aliases = await this.getAllAliases(roomId);
            if (aliases.indexOf(desiredAlias) === -1) {
                return this.client.sendNotice(roomId, "That room alias doesn't belong to this room or doesn't exist");
            }

            aliasPromise = this.client.deleteRoomAlias(desiredAlias).then(() => {
                return this.client.sendNotice(roomId, "The room alias has been removed.");
            });
        }

        return aliasPromise.catch(err => {
            if (err['body'] && err['body']['error']) {
                const errMessage = err['body']['error'];

                if (errMessage === "Room alias " + desiredAlias + " already exists") {
                    return this.client.sendNotice(roomId, "That room alias is already in use by another room");
                } else if (errMessage === "Room alias must be local") {
                    return this.client.sendNotice(roomId, "That room alias is invalid");
                } else if (errMessage === "You don't have permission to delete the alias.") {
                    return this.client.sendNotice(roomId, "The alias does not exist or I do not have permission to remove the alias");
                }
            }

            LogService.error("CommandProcessor", err);
            return this.client.sendNotice(roomId, "There was an error processing your command");
        });
    }

    private async getAllAliases(roomId: string): Promise<string[]> {
        try {
            const events = await this.client.getRoomState(roomId).filter(e => e['type'] === "m.room.aliases");
            const aliases = [];

            for (const event of events) {
                if (event['content'] && event['content']['aliases']) {
                    event['content']['aliases'].forEach(a => aliases.push(a));
                }
            }

            return aliases;
        } catch (err) {
            LogService.error("CommandProcessor", err);
        }

        return [];
    }

    private async hasPermission(roomId: string, sender: string): Promise<boolean> {
        const plEvent = await this.client.getRoomStateEvents(roomId, "m.room.power_levels", "");
        if (!plEvent) return false;

        let userLevel = 0;
        let requiredLevel = 50;
        if (plEvent['users_default']) userLevel = plEvent['users_default'];
        if (plEvent['users'] && plEvent['users'][sender]) userLevel = plEvent['users'][sender];
        if (plEvent['state_default']) requiredLevel = plEvent['state_default'];

        return userLevel >= requiredLevel;
    }
}