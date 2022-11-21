# karen

## Local Dev

1. Clone this repo
2. Clone george
4. Copy a `config.json` file (e.g. from live), empty the secret values, and put it into `~george/karen/src/config.json`
5. Create a MySQL database, give a user access, update the "database" section of the config.
6. Run `npm run migrate` to initialize the database, or use MySQL Workbench to export & import a version of the database from live.
7. Run `docker-compose -f docker-compose.yaml -f docker-compose.dev.yaml up --detach karen db` within the george repo to start the application up within a Docker container. 
8. Local development should be against `https://karen-dev.ngrok.io`, as services (e.g. LightWave) need a public endpoint to POST updates to. So install `ngrok` if you haven't got it already, login to their site and follow the getting started steps.
9. For LightwaveRF
    1. Login to https://my.lightwaverf.com
    2. Go to settings -> API
    3. Copy the "Refresh token" into config.json. The "Basic" value is the "bearer" in config.json.
    4. Make up a "secret" for the config.json
    5. Start Karen locally
    6. Go to "https://karen-dev.ngrok.io/lightwaverf/setup?secret={your-secret}"
    7. You should now have a "structure" and "event_id" set in the config.json, and LightwaveRF is now configured.
10. For Alexa;
    1. Sign in to https://developer.amazon.com/alexa/console/ask/ as your dev user.
    2. Click into the dev skill, and go to Account Linking
    3. Add an element to the "authentication.clients" section of config.json, whose "client_id" and "client_secret" matches that in the Alexa Console.
    4. Set the access_token to a secret value
    5. Go to "Permissions" in the Alexa Console.
    6. Copy the "Client Id" and "Client Secret" into "client_id" and "client_secret" values under `config.alexa`.
    5. Start Karen locally
    6. On your phone, sign into the Alexa app as the dev user.
    7. Go to More, Skills & Games, Your Skills, Dev, (the skill)
    8. Click "Enable to use".

## Deploy

1. Login to NAS
2. `cd /volume2/docker/george`
3. `docker-compose pull karen`
4. `docker-compose up --detach karen`
