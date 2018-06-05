# matrix-alias-bot

[![TravisCI badge](https://travis-ci.org/turt2live/matrix-alias-bot.svg?branch=master)](https://travis-ci.org/turt2live/matrix-alias-bot)

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
mkdir -p /matrix-alias-bot/config
mkdir -p /matrix-alias-bot/logs

# Create the configuration file. Use the default configration as a template.
# Be sure to change the log path to /data/logs
nano /matrix-alias-bot/config/production.yaml

# Run the container
docker run -v /matrix-alias-bot:/data turt2live/matrix-alias-bot
```
