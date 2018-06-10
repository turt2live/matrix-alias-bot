import Provisioner, { ERR_ALIAS_UNKNOWN_ERROR, ProvisionerError } from "./Provisioner";
import * as express from "express";
import * as bodyParser from "body-parser";
import { LogService } from "matrix-js-snippets";
import config from "./config";
import * as expressInterceptor from "express-interceptor";

export default class ProvisioningApi {

    private app: any;

    public constructor(private provisioner: Provisioner) {
        this.app = express();
        this.app.use(bodyParser.json());

        // Log incoming requests
        this.app.use((req, res, next) => {
            LogService.verbose("ProvisioningApi", "Incoming request: " + req.method + " " + req.url);
            next();
        });

        // Always return JSON
        this.app.use(expressInterceptor((req, res) => {
            return {
                isInterceptable: () => {
                    return res.get("Content-Type").startsWith("text/plain") || res.get("Content-Type").startsWith("text/html");
                },
                intercept: (body, send) => {
                    res.set("Content-Type", "application/json");
                    send(JSON.stringify({
                        statusCode: res.statusCode,
                        success: !(res.statusCode < 200 || res.statusCode >= 300),
                        error: body,
                        errcode: ERR_ALIAS_UNKNOWN_ERROR,
                    }));
                },
            };
        }));

        // Handle other errors explicitly too
        this.app.use((err, req, res, next) => {
            LogService.error("ProvisioningApi", err);

            if (err instanceof ProvisionerError) {
                res.status(500);
                res.set("Content-Type", "application/json");
                res.send(JSON.stringify(err));
                next("Error encountered during hook processing");
            }

            let status = 500;
            let message = "Internal Server Error";
            if (err.message.startsWith("Unexpected token ") && err.message.includes("in JSON at position")) {
                message = err.message;
                status = 400;
            }

            res.status(status);
            res.set("Content-Type", "application/json");
            res.send(JSON.stringify({errcode: ERR_ALIAS_UNKNOWN_ERROR, error: message}));
            next("Error encountered during hook processing");
        });

        // Register the routes
        this.app.get("/api/v1/user/:userId", this.getUserPermissions.bind(this));
        this.app.get("/api/v1/rooms/:roomId/aliases", this.getAliasesInRoom.bind(this));
        this.app.put("/api/v1/rooms/:roomId/aliases/:alias", this.addAliasToRoom.bind(this));
        this.app.delete("/api/v1/rooms/:roomId/aliases/:alias", this.removeAliasFromRoom.bind(this));
        this.app.get("/api/v1/rooms/:roomId/directory_visibility", this.getDirectoryVisibility.bind(this));
        this.app.put("/api/v1/rooms/:roomId/directory_visibility/:visibility", this.setDirectoryVisibility.bind(this));
    }

    public start() {
        this.app.listen(config.provisioning.port, config.provisioning.bind);
        LogService.info("ProvisioningApi", "Now listening on " + config.provisioning.bind + ":" + config.provisioning.port);
    }

    private validateToken(req): boolean {
        const token = req.get("Authorization");
        return !(!token || token !== "Bearer " + config.provisioning.sharedSecret);
    }

    private async getUserPermissions(req, res): Promise<any> {
        if (!this.validateToken(req)) {
            return res.status(401).send({errcode: "T2B_INVALID_TOKEN", error: "Token incorrect or missing"});
        }

        const allowedAliases = await this.provisioner.getAllowedAliases(req.params.userId);
        const isAdmin = await this.provisioner.isAdmin(req.params.userId);

        return res.status(200).send({
            isAdmin: isAdmin,
            allowedAliases: allowedAliases,
        });
    }

    private async getAliasesInRoom(req, res): Promise<any> {
        if (!this.validateToken(req)) {
            return res.status(401).send({errcode: "T2B_INVALID_TOKEN", error: "Token incorrect or missing"});
        }

        const aliases = await this.provisioner.getAliasesInRoom(req.params.roomId, req.query.userId);

        return res.status(200).send({
            aliases: aliases,
        });
    }

    private async addAliasToRoom(req, res): Promise<any> {
        if (!this.validateToken(req)) {
            return res.status(401).send({errcode: "T2B_INVALID_TOKEN", error: "Token incorrect or missing"});
        }

        const alias = await this.provisioner.addAlias(req.params.roomId, req.query.userId, "#" + req.params.alias);

        return res.status(200).send({
            alias: alias,
        });
    }

    private async removeAliasFromRoom(req, res): Promise<any> {
        if (!this.validateToken(req)) {
            return res.status(401).send({errcode: "T2B_INVALID_TOKEN", error: "Token incorrect or missing"});
        }

        const alias = await this.provisioner.removeAlias(req.params.roomId, req.query.userId, "#" + req.params.alias);

        return res.status(200).send({
            alias: alias,
        });
    }

    private async getDirectoryVisibility(req, res): Promise<any> {
        if (!this.validateToken(req)) {
            return res.status(401).send({errcode: "T2B_INVALID_TOKEN", error: "Token incorrect or missing"});
        }

        const visibility = await this.provisioner.getRoomDirectoryVisibility(req.params.roomId, req.query.userId);

        return res.status(200).send({
            visibility: visibility,
        });
    }

    private async setDirectoryVisibility(req, res): Promise<any> {
        if (!this.validateToken(req)) {
            return res.status(401).send({errcode: "T2B_INVALID_TOKEN", error: "Token incorrect or missing"});
        }

        const visibility = req.params.visibility;
        if (visibility !== "private" && visibility !== "public") {
            return res.status(400).send({
                error: "Visibility must be 'public' or 'private'",
                errcode: ERR_ALIAS_UNKNOWN_ERROR
            });
        }

        if (visibility === "public") {
            await this.provisioner.listRoomInDirectory(req.params.roomId, req.query.userId);
        } else {
            await this.provisioner.removeRoomFromDirectory(req.params.roomId, req.query.userId);
        }

        return res.status(200).send({
            visibility: visibility,
        });
    }
}