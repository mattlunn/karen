# karen

## Local Dev

1. Clone this repo
2. Clone george
4. Copy a `config.json` file (e.g. from live), empty the secret values, and put it into `./server/src/config.json`
5. Create a MySQL database, give a user access, update the "database" section of the config.
6. Run `npm run migrate` to initialize the database, or use MySQL Workbench to export & import a version of the database from live.
7. Run `npm run dev` to setup `babel` to watch the src directory and build-as-you-save.
8. In a separate terminal window, run `npm run start:dev` to setup `nodemon` to auto-restart the server when changes to `dist` (published by babel) are made. 
9. Local development should be against `https://karen-dev.ngrok.io`, as services (e.g. LightWave) need a public endpoint to POST updates to. So install `ngrok` if you haven't got it already, login to their site and follow the getting started steps.
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

Deploys should be automated upon push to master, because of the webhook in the GHA pipeline, which calls out to the karen-updater container of watchtower. But, to do manually;

1. Login to NAS
2. `cd /volume2/docker/george`
3. `docker-compose pull karen`
4. `docker-compose up --detach karen`
