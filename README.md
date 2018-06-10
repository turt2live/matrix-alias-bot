# matrix-alias-bot

[![TravisCI badge](https://travis-ci.org/turt2live/matrix-alias-bot.svg?branch=master)](https://travis-ci.org/turt2live/matrix-alias-bot)
[![API Documentation](https://img.shields.io/badge/api%20documentation-Postman-blue.svg)](https://documenter.getpostman.com/view/1707443/RWEcNfTX)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/68b2d069fbc0af28546d#?env%5BAlias%20Bot%20Sample%5D=W3sia2V5IjoidXNlcklkIiwidmFsdWUiOiJAZXhhbXBsZTptYXRyaXgub3JnIiwiZW5hYmxlZCI6dHJ1ZSwidHlwZSI6InRleHQifSx7ImtleSI6InJvb21JZCIsInZhbHVlIjoiIXJhbmRvbTptYXRyaXgub3JnIiwiZW5hYmxlZCI6dHJ1ZSwidHlwZSI6InRleHQifSx7ImtleSI6InNoYXJlZFNlY3JldCIsInZhbHVlIjoiQ0hBTkdFX01FIiwiZW5hYmxlZCI6dHJ1ZSwidHlwZSI6InRleHQifSx7ImtleSI6ImJvdEFkZHJlc3MiLCJ2YWx1ZSI6Imh0dHA6Ly9sb2NhbGhvc3Q6NDUwMiIsImVuYWJsZWQiOnRydWUsInR5cGUiOiJ0ZXh0In0seyJrZXkiOiJhbGlhcyIsInZhbHVlIjoibXljb29sYWxpYXMiLCJlbmFibGVkIjp0cnVlLCJ0eXBlIjoidGV4dCJ9XQ==)

A matrix bot that allows users to add aliases on the homeserver it runs on. 

Questions? Ask away in [#aliasbot:t2bot.io](https://matrix.to/#/#aliasbot:t2bot.io)

# Usage

1. Invite `@alias:t2bot.io` to a room
2. Give the bot permission to add aliases (configure the room)
3. Add your desired alias: `!alias #my_cool_alias`

For information on the available aliases, type `!alias allowed`

# Building your own

*Note*: You'll need to have access to an account that the bot can use to get the access token.

1. Clone this repository
2. `npm install`
3. `npm run build`
3. Copy `config/default.yaml` to `config/production.yaml`
4. Run the bot with `NODE_ENV=production node lib/index.js`

### Docker

```
# Create the directory structure
# This is all the information kept in the volume: config, logs, and cache
mkdir -p /matrix-alias-bot/config
mkdir -p /matrix-alias-bot/logs
mkdir -p /matrix-alias-bot/storage

# Create the configuration file. Use the default configration as a template.
# Be sure to change the log path to /data/logs
# Be sure to point the dataPath at /data/storage
nano /matrix-alias-bot/config/production.yaml

# Run the container
docker run -v /matrix-alias-bot:/data turt2live/matrix-alias-bot
```
