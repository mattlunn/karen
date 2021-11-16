# karen

## Getting Started

1. Do your normal clone and `npm install`
2. Copy a `config.json` file (e.g. from live), and empty the secret values.
3. Create a MySQL database, give a user access, update the "database" section of the config.
4. Run `npm run migrate` to initialize the database, or use MySQL Workbench to export & import a version of the database from live.
5. Local development should be against `https://karen-dev.ngrok.io`, as services (e.g. Smart Things) need a public endpoint to POST updates to. So install `ngrok` if you haven't got it already, login to their site and follow the getting started steps.
6. For SmartThings;
    1. Sign into https://smartthings.developer.samsung.com/workspace/projects
    2. Click into the dev project, then click "View Details"
    3. Copy across the Client ID, Client Secret and App ID into the settings.
    4. Start Karen locally
    5. On your phone open Smart Things, go to Automations, Karen Dev, click next next next, and the flow should complete.
    6. You should now have a "refresh_token" in the config.json, and SmartThings is now configured.
7. For LightWaveRF
    1. Who knows.
