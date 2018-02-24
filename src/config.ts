import * as config from "config";
import { LogConfig } from "matrix-js-snippets";

interface IConfig {
    homeserverUrl: string;
    accessToken: string;
    aliasDomain: string;
    allowedAliases: string[];
    adminUsers: string[];

    logging: LogConfig;
}

export default <IConfig>config;