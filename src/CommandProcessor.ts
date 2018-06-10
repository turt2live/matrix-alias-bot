import { MatrixClient } from "matrix-bot-sdk";
import config from "./config";
import Provisioner, {
    ERR_ALIAS_CANNOT_DELETE,
    ERR_ALIAS_INVALID,
    ERR_ALIAS_NOT_ALLOWED,
    ERR_ALIAS_NOT_FOUND,
    ERR_ALIAS_PERMISSION_DENIED,
    ERR_ALIAS_TAKEN
} from "./Provisioner";
import { LogService } from "matrix-js-snippets";
import striptags = require("striptags");

export class CommandProcessor {
    constructor(private client: MatrixClient, private provisioner: Provisioner) {
    }

    public async tryCommand(roomId: string, event: any): Promise<any> {
        const message = event['content']['body'];
        if (!message || !message.startsWith("!alias")) return;

        let command = "help";
        const args = message.substring("!alias".length).trim().split(" ");
        if (args.length > 0) {
            command = args[0];
            args.splice(0, 1);
        }

        if (command === "allowed") {
            const allowedAliases = await this.provisioner.getAllowedAliases(event['sender']);
            const htmlMessage = "<p>You are able to use the following alias formats<br /><ul><li><code>" + allowedAliases.join("</code></li><li><code>") + "</code></li></ul></p>";
            return this.sendHtmlReply(roomId, event, htmlMessage, "info");
        } else if (command === "remove" || command === "add" || command[0] === "#") {
            let alias = command;
            let adding = true;
            if (command[0] !== "#") {
                if (args.length < 1) {
                    return this.sendHtmlReply(roomId, event, "Please provide a room alias. For help, say !alias help", "warning");
                }

                alias = args[0];
                adding = command === "add";
            }

            if (adding) {
                await this.provisioner.addAlias(roomId, event['sender'], alias)
                    .then(() => this.sendHtmlReply(roomId, event, "That alias has been added to the room.", "success"))
                    .catch(err => {
                        if (err.errorCode) {
                            switch (err.errorCode) {
                                case ERR_ALIAS_PERMISSION_DENIED:
                                    return this.sendHtmlReply(roomId, event, "You do not have permission to add aliases in this room.", "error");
                                case ERR_ALIAS_NOT_ALLOWED:
                                    return this.sendHtmlReply(roomId, event, "That alias is not allowed.", "error");
                                case ERR_ALIAS_TAKEN:
                                    return this.sendHtmlReply(roomId, event, "That alias is already in use in another room.", "error");
                                case ERR_ALIAS_INVALID:
                                    return this.sendHtmlReply(roomId, event, "That alias is invalid.", "error");
                            }
                        }

                        return this.sendHtmlReply(roomId, event, "There was an error processing your command.", "critical");
                    });
            } else {
                await this.provisioner.removeAlias(roomId, event['sender'], alias)
                    .then(() => this.sendHtmlReply(roomId, event, "That alias has been removed from the room.", "success"))
                    .catch(err => {
                        if (err.errorCode) {
                            switch (err.errorCode) {
                                case ERR_ALIAS_PERMISSION_DENIED:
                                    return this.sendHtmlReply(roomId, event, "You do not have permission to add aliases in this room.", "error");
                                case ERR_ALIAS_NOT_ALLOWED:
                                    return this.sendHtmlReply(roomId, event, "That alias is not allowed.", "error");
                                case ERR_ALIAS_NOT_FOUND:
                                    return this.sendHtmlReply(roomId, event, "That alias does not exist or does not belong to this room.", "error");
                                case ERR_ALIAS_INVALID:
                                    return this.sendHtmlReply(roomId, event, "That alias is invalid.", "error");
                                case ERR_ALIAS_CANNOT_DELETE:
                                    return this.sendHtmlReply(roomId, event, "The alias does not exist or I do not have permission to remove it.", "error");
                            }
                        }

                        return this.sendHtmlReply(roomId, event, "There was an error processing your command.", "critical");
                    });
            }
        } else if (command === "publish") {
            return this.provisioner.listRoomInDirectory(roomId, event['sender']).then(() => {
                return this.sendHtmlReply(roomId, event, "This room will now appear in the public room directory.", "success");
            }).catch(e => {
                LogService.error("CommandProcessor", e);
                return this.sendHtmlReply(roomId, event, "There was an error processing your command.", "critical");
            });
        } else if (command === "unpublish") {
            return this.provisioner.removeRoomFromDirectory(roomId, event['sender']).then(() => {
                return this.sendHtmlReply(roomId, event, "This room has been removed from the public room directory.", "success");
            }).catch(e => {
                LogService.error("CommandProcessor", e);
                return this.sendHtmlReply(roomId, event, "There was an error processing your command.", "critical");
            });
        } else {
            const htmlMessage = "<p>Alias bot help:<br /><pre><code>" +
                `!alias #mycoolalias          - Adds an alias on ${config.aliasDomain}\n` +
                "!alias remove &lt;alias&gt;        - Removes the given alias from the room\n" +
                "!alias allowed               - Lists the allowed alias formats\n" +
                `!alias publish               - Publishes this room on the public room directory for ${config.aliasDomain}\n` +
                `!alias unpublish             - Removes this room from the public room directory for ${config.aliasDomain}\n` +
                "!alias help                  - This menu\n" +
                "</code></pre></p>" +
                (config.helpChannel ? "<p>For help or more information, visit <a href='https://matrix.to/#/" + config.helpChannel + "'>" + config.helpChannel + "</a></p>" : "");
            return this.sendHtmlReply(roomId, event, htmlMessage, "info");
        }
    }

    private sendHtmlReply(roomId: string, event: any, message: string, status: "info" | "warning" | "error" | "critical" | "success"): Promise<any> {
        const plain = "> <" + event['sender'] + "> " + event['content']['body'] + "\n\n" + striptags(message);
        const html = "" +
            "<mx-reply><blockquote>" +
            "<a href='https://matrix.to/#/" + roomId + "/" + event['event_id'] + "'>In reply to</a> <a href='https://matrix.to/#/" + event['sender'] + "'>" + event['sender'] + "</a><br/>" +
            event['content']['body'] + "</blockquote></mx-reply>" + message;
        return this.client.sendMessage(roomId, {
            msgtype: "m.notice",
            body: plain,
            format: "org.matrix.custom.html",
            formatted_body: html,
            status: status,
            "m.relates_to": {
                "m.in_reply_to": {
                    event_id: event['event_id'],
                },
            },
        });
    }
}