# karen

## Local Dev

1. Clone this repo
2. Clone george
4. Create `server/config/app.json` (e.g. from live, with the secrets replaced by your own). Automations live in its `automations` array. See "Config" below for secrets.
5. Create a MySQL database, give a user access, update the "database" section of the config.
6. Run `npm run migrate` to initialize the database, or use MySQL Workbench to export & import a version of the database from live.
7. Run `npm run dev` to setup `babel` to watch the src directory and build-as-you-save.
8. In a separate terminal window, run `npm run start:dev` to setup `nodemon` to auto-restart the server when changes to `dist` (published by babel) are made. 
9. Local development should be against `https://karen-dev.ngrok.io`, as services (e.g. LightWave) need a public endpoint to POST updates to. So install `ngrok` if you haven't got it already, login to their site and follow the getting started steps.
10. For Alexa;
    1. Sign in to https://developer.amazon.com/alexa/console/ask/ as your dev user.
    2. Click into the dev skill, and go to Account Linking
    3. Add an element to the "authentication.clients" section of app.json, whose "client_id" and "client_secret" matches that in the Alexa Console.
    4. Set the access_token to a secret value
    5. Go to "Permissions" in the Alexa Console.
    6. Copy the "Client Id" and "Client Secret" into "client_id" and "client_secret" values under `config.alexa`.
    5. Start Karen locally
    6. On your phone, sign into the Alexa app as the dev user.
    7. Go to More, Skills & Games, Your Skills, Dev, (the skill)
    8. Click "Enable to use".

## Config

Karen reads everything from `server/config/` (gitignored; beside `src/` and `dist/`). On production the host's config directory is bind-mounted there as a **directory** (not individual files):

| File | Contents | Written by |
|---|---|---|
| `app.json` | All settings, including `automations`. Secrets are inline as `{ "$encrypted": "<base64>" }`. | You. Saving it restarts Karen within a few seconds. |
| `config.key` | The base64 AES-256 key that decrypts those secrets. | Created once. |
| `state.json` | Runtime values Karen persists itself (OAuth refresh tokens, SmartCar IDs). | Karen. Only hand-edit it while Karen is stopped. |

Because the directory is mounted rather than each file, editing `app.json` from the host is fine — editors that save by renaming a temp file over the original are picked up by the container.

### Adding or changing a secret

Run this wherever that environment's `config.key` lives, and paste the output into `app.json` as `{ "$encrypted": "<output>" }`:

```bash
docker compose exec karen npm run encrypt-secret                # prompts for the value
printf '%s' "$VALUE" | docker compose exec -T karen npm run encrypt-secret   # or pipe it in
```

## Deploy

Deploys should be automated upon push to master, because of the webhook in the GHA pipeline, which calls out to the karen-updater container of watchtower. But, to do manually;

1. SSH to george
2. `cd ~/docker/george`
3. `docker compose pull karen`
4. `docker compose up --detach karen`
