import { MatrixClient } from "matrix-bot-sdk";
import config from "./config";
import { LogService } from "matrix-js-snippets";
import wildcard = require("node-wildcard");

export default class Provisioner {

    public constructor(private client: MatrixClient) {
    }

    /**
     * Adds an alias to the given room
     * @param {string} roomId The room ID to add the alias to
     * @param {string} userId The user ID adding the alias
     * @param {string} alias The alias to add
     * @return {Promise<*, ProvisionerError>} Resolves when the alias has been added. Rejected if there was an error.
     */
    public async addAlias(roomId: string, userId: string, alias: string): Promise<any> {
        const hasPermission = await this.hasPermission(roomId, userId);
        const allowedAliases = await this.getAllowedAliases(userId);

        let transformedAlias = alias;
        if (!transformedAlias.endsWith(":" + config.aliasDomain))
            transformedAlias = transformedAlias + ":" + config.aliasDomain;

        const isAllowed = allowedAliases.find(a => wildcard(transformedAlias, a));

        if (!hasPermission) throw new ProvisionerError(ERR_ALIAS_PERMISSION_DENIED, "You cannot add aliases in this room.");
        if (!isAllowed) throw new ProvisionerError(ERR_ALIAS_NOT_ALLOWED, "The alias you provided is not allowed.");

        return this.client.createRoomAlias(transformedAlias, roomId).catch(err => {
            LogService.error("Provisioner", "Error adding alias '" + transformedAlias + "' to " + roomId);
            LogService.error("Provisioner", err);

            if (err["body"] && err["body"]["error"]) {
                const errMessage = err['body']['error'];

                if (errMessage === "Room alias " + transformedAlias + " already exists") {
                    return Promise.reject(new ProvisionerError(ERR_ALIAS_TAKEN, "The alias is already in use by another room."));
                } else if (errMessage === "Room alias must be local") {
                    return Promise.reject(new ProvisionerError(ERR_ALIAS_INVALID, "The alias is invalid"));
                }
            }

            return Promise.reject(new ProvisionerError(ERR_ALIAS_UNKNOWN_ERROR, "An unknown error occurred while adding the alias"));
        });
    }

    /**
     * Removes an alias from a room
     * @param {string} roomId The room ID to remove the alias from
     * @param {string} userId The user ID removing the alias
     * @param {string} alias The alias to remove
     * @return {Promise<*, ProvisionerError>} Resolves when the alias has been removed. Rejected if there was an error.
     */
    public async removeAlias(roomId: string, userId: string, alias: string): Promise<any> {
        const hasPermission = await this.hasPermission(roomId, userId);
        const allowedAliases = await this.getAllowedAliases(userId);

        let transformedAlias = alias;
        if (!transformedAlias.endsWith(":" + config.aliasDomain))
            transformedAlias = transformedAlias + ":" + config.aliasDomain;

        const isAllowed = allowedAliases.find(a => wildcard(transformedAlias, a));

        if (!hasPermission) throw new ProvisionerError(ERR_ALIAS_PERMISSION_DENIED, "You cannot remove aliases in this room.");
        if (!isAllowed) throw new ProvisionerError(ERR_ALIAS_NOT_ALLOWED, "The alias you provided is not allowed.");

        const aliases = await this.getAliasesInRoom(roomId, userId);
        if (aliases.indexOf(transformedAlias) === -1) throw new ProvisionerError(ERR_ALIAS_NOT_FOUND, "The alias does not appear to belong to this room or does not exist.");

        return this.client.deleteRoomAlias(transformedAlias).catch(err => {
            LogService.error("Provisioner", "Error removing alias '" + transformedAlias + "' to " + roomId);
            LogService.error("Provisioner", err);

            if (err["body"] && err["body"]["error"]) {
                const errMessage = err['body']['error'];

                if (errMessage === "Room alias must be local") {
                    return Promise.reject(new ProvisionerError(ERR_ALIAS_INVALID, "The alias is invalid"));
                } else if (errMessage === "You don't have permission to delete the alias.") {
                    return Promise.reject(new ProvisionerError(ERR_ALIAS_CANNOT_DELETE, "The alias does not exist or the bot does not have permission to remove the alias."));
                }
            }

            return Promise.reject(new ProvisionerError(ERR_ALIAS_UNKNOWN_ERROR, "An unknown error occurred while removing the alias"));
        });
    }

    /**
     * Gets the aliases the user is allowed to use. Wildcards (*) may be included to represent a wide variety of aliases.
     * @param {string} userId The user ID to get the allowed aliases for
     * @return {Promise<string[], ProvisionerError>} Resolves to the allowed aliases. Rejected if there was an error.
     */
    public async getAllowedAliases(userId: string): Promise<string[]> {
        const allowed: string[] = [];
        if (await this.isAdmin(userId)) allowed.push("#*");
        return allowed.concat(config.allowedAliases);
    }

    /**
     * Gets the aliases in the room. Only retrieves the aliases the bot is capable of reaching.
     * @param {string} roomId The room ID to get the aliases in
     * @param {string} userId The user ID performing the request (must be in the room)
     * @return {Promise<string[], ProvisionerError>} Resolves to the aliases in the room. Rejected if there was an error.
     */
    public async getAliasesInRoom(roomId: string, userId: string): Promise<string[]> {
        if (!(await this.isInRoom(userId, roomId))) throw new ProvisionerError(ERR_ALIAS_PERMISSION_DENIED, "You are not in the room.");

        const aliasesEvent = await this.client.getRoomStateEvents(roomId, "m.room.aliases", config.aliasDomain);
        if (!aliasesEvent || !aliasesEvent["aliases"]) return [];

        return aliasesEvent["aliases"];
    }

    /**
     * Determines if the user is an admin for this bot.
     * @param {string} userId The user ID to check the administrator status of
     * @return {Promise<boolean, ProvisionerError>} Resolves to true or false representing the user's administrator status. Rejected if there was an error.
     */
    public async isAdmin(userId: string): Promise<boolean> {
        return config.adminUsers.indexOf(userId) !== -1;
    }

    private async hasPermission(roomId: string, userId: string): Promise<boolean> {
        if (await this.isAdmin(userId)) return true;
        if (!(await this.isInRoom(userId, roomId))) return false;

        const plEvent = await this.client.getRoomStateEvents(roomId, "m.room.power_levels", "");
        console.log(plEvent);
        if (!plEvent) return false;

        let userLevel = 0;
        let requiredLevel = 50;
        if (plEvent['users_default']) userLevel = plEvent['users_default'];
        if (plEvent['users'] && plEvent['users'][userId]) userLevel = plEvent['users'][userId];
        if (plEvent['state_default']) requiredLevel = plEvent['state_default'];

        return userLevel >= requiredLevel;
    }

    private async isInRoom(userId: string, roomId: string): Promise<boolean> {
        if (await this.isAdmin(userId)) return true;

        try {
            const members = await this.client.getJoinedRoomMembers(roomId);
            return members.indexOf(userId) !== -1;
        } catch (err) {
            LogService.error("Provisioner", err);
            throw new ProvisionerError(ERR_ALIAS_UNKNOWN_ERROR, "Error retrieving the room members", err);
        }
    }
}

export class ProvisionerError extends Error {
    constructor(public readonly errorCode: string, public readonly message: string, public readonly originalError: Error = null) {
        super(message);
    }
}

export const ERR_ALIAS_TAKEN = "T2B_ALIAS_TAKEN";
export const ERR_ALIAS_NOT_FOUND = "T2B_ALIAS_NOT_FOUND";
export const ERR_ALIAS_INVALID = "T2B_ALIAS_INVALID";
export const ERR_ALIAS_CANNOT_DELETE = "T2B_ALIAS_CANNOT_DELETE";
export const ERR_ALIAS_PERMISSION_DENIED = "T2B_ALIAS_PERMISSION_DENIED";
export const ERR_ALIAS_NOT_ALLOWED = "T2B_ALIAS_NOT_ALLOWED";
export const ERR_ALIAS_UNKNOWN_ERROR = "T2B_ALIAS_UNKNOWN_ERROR";
