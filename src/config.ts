import * as config from "config";
import { LogConfig } from "matrix-js-snippets";

interface IConfig {
    homeserverUrl: string;
    accessToken: string;
    aliasDomain: string;
    allowedAliases: string[];
    adminUsers: string[];
    dataPath: string;
    helpChannel: string;

    provisioning: {
        enabled: boolean;
        bind: string;
        port: number;
        sharedSecret: string;
    };

    logging: LogConfig;
}

const conf = <IConfig>config;

if (process.env["BOT_PORT"]) {
    const realPort = Number(process.env["BOT_PORT"]);
    if (realPort !== Number(conf.provisioning.port)) {
        console.warn("Configuration and environment variables do not agree on the webserver port. Using " + realPort);
    }

    conf.provisioning.port = realPort;
}

if (process.env["BOT_BIND"]) {
    const realBind = process.env["BOT_BIND"];
    if (realBind !== conf.provisioning.bind) {
        console.warn("Configuration and environment variables do not agree on the webserver bind address. Using " + realBind);
    }

    conf.provisioning.bind = realBind;
}

if (process.env["BOT_DATA_PATH"]) {
    const realPath = process.env["BOT_DATA_PATH"];
    if (realPath !== conf.dataPath) {
        console.warn("Configuration and environment variables do not agree on the data path. Using " + realPath);
    }

    conf.dataPath = realPath;
}

if (process.env["BOT_DOCKER_LOGS"]) {
    console.log("Altering log configuration to only write out to console");
    conf.logging = {
        file: "/data/logs/alias.log",
        console: true,
        consoleLevel: conf.logging.consoleLevel,
        fileLevel: "error",
        writeFiles: false,
        rotate: {
            size: 0,
            count: 0,
        },
    };
}

export default conf;