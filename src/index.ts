import { AutojoinRoomsMixin, AutojoinUpgradedRoomsMixin, MatrixClient, SimpleRetryJoinStrategy } from "matrix-bot-sdk";
import config from "./config";
import { LogService } from "matrix-js-snippets";
import { CommandProcessor } from "./CommandProcessor";
import { LocalstorageStorageProvider } from "./LocalstorageStorageProvider";
import Provisioner from "./Provisioner";
import ProvisioningApi from "./ProvisioningApi";

LogService.configure(config.logging);
const storageProvider = new LocalstorageStorageProvider(config.dataPath);
const client = new MatrixClient(config.homeserverUrl, config.accessToken, storageProvider);

let botUserId = "";
client.getUserId().then(uid => {
    botUserId = uid;

    const provisioner = new Provisioner(client, botUserId);
    const commands = new CommandProcessor(client, provisioner);
    if (config.provisioning.enabled) {
        if (config.provisioning.sharedSecret === "CHANGE_ME") {
            LogService.error("index", "Provisioning enabled but the shared secret has not been changed. Please change the shared secret.");
            process.exit(1);
        }

        const api = new ProvisioningApi(provisioner);
        api.start();
    }

    client.on("room.message", (roomId, event) => {
        if (event['sender'] === botUserId) return;
        if (event['type'] !== "m.room.message") return;
        if (!event['content']) return;
        if (event['content']['msgtype'] !== "m.text") return;

        return commands.tryCommand(roomId, event);
    });

    client.on("room.upgraded", async (newRoomId, event) => {
        const oldRoomId = event['content']['predecessor']['room_id'];

        const directoryVisibility = await provisioner.getRoomDirectoryVisibility(oldRoomId, botUserId);

        const oldAliases = await provisioner.getAliasesInRoom(oldRoomId, botUserId);
        for (const alias of oldAliases) {
            await provisioner.removeAlias(oldRoomId, botUserId, alias);
            await provisioner.addAlias(newRoomId, botUserId, alias);
        }

        let message = "I have migrated the aliases I can from your old room and added them here: " + oldAliases.join(", ");

        if (directoryVisibility === 'public') {
            await provisioner.listRoomInDirectory(newRoomId, botUserId);
            message += "\n\nAdditionally, I have listed this room in the room directory for " + config.aliasDomain;
        }

        return client.sendNotice(newRoomId, message);
    });

    AutojoinRoomsMixin.setupOnClient(client);
    AutojoinUpgradedRoomsMixin.setupOnClient(client);
    client.setJoinStrategy(new SimpleRetryJoinStrategy());
    return client.start();
}).then(() => LogService.info("index", "Alias bot started!"));
