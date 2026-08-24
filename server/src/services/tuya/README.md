# Tuya (local)

Controls devices built on the Tuya platform (e.g. white-labelled devices from
brands like Mus Flame) purely over the local network via `tuyapi` — no cloud
dependency at runtime. Follows the same shape as the `tplink`/`sony-bravia`
providers: devices are defined in `config/app.json`, not auto-discovered.

## Adding a new device

### 1. Unlink from the vendor app, re-pair via Smart Life

White-labelled Tuya devices are usually locked to their vendor's app and
need to be freed before they can be paired elsewhere.

- In the vendor app (e.g. Mus Flame), remove/unlink the device from your
  account. If it doesn't fully release, factory reset it (see the device's
  manual — often holding a physical button for several seconds).
- Install the **Smart Life** app, create an account, and pair the device.
  Use a **2.4GHz** Wi-Fi network — Tuya modules don't support 5GHz.

### 2. Create a Tuya IoT Platform cloud project

This is only needed to extract the device's local key. Karen never talks
to Tuya's cloud at runtime — everything after this step is local network.

- Sign up for a free developer account at `iot.tuya.com`.
- **Cloud → Create Cloud Project** → "Smart Home" (trial) → pick the
  **Data Center** matching your Smart Life account's region (UK/most of
  Europe → Central Europe Data Center). If unsure, guess based on region —
  the linking step in the next bullet will fail if it's wrong, and you can
  just delete and recreate the project with a different data center.
- Note the project's **Access ID** and **Access Secret** from the project
  overview page.
- Project → **Devices** tab → **"Link Tuya App Account"** → **Custom Link**
  (not Automatic — this avoids exposing every device on your Smart Life
  account to the cloud project) → scan the QR code with the Smart Life app
  (Me tab → scan icon) → link just the target device.

### 3. Extract the device ID and local key with tinytuya

```bash
pip install tinytuya
python3 -m tinytuya wizard
```

Answer the prompts:
- API Key / API Secret → the Access ID / Access Secret from step 2.
- Any Device ID currently registered → the device ID shown in the Tuya IoT
  Platform's Devices tab (or `scan`, if you're on the same LAN as it).
- Region → the code matching your data center (`eu` for Central Europe,
  `eu-w` for Western Europe, `us`/`us-e` for America, `cn` for China, `in`
  for India).
- "Poll local devices?" → only say yes if you're running this from a
  machine on the same LAN as the device — it'll auto-detect its IP and
  protocol version for you and save them into `devices.json`.

This writes `devices.json` with each linked device's `id`, `key` (the
local key), and its DP (`mapping`) schema — the full list of data points
the device exposes.

### 4. Find the device's local IP and reserve it

- If step 3 didn't already find it, check your router's DHCP client list
  for the device's MAC address.
- **Set a DHCP reservation for it.** Local-key control depends on a stable
  IP — without a reservation the device can get a new address after a
  power cycle and silently break the integration.

### 5. Determine the protocol version

- Most post-2019 Tuya hardware uses `"3.3"`.
- To confirm: an open TCP port `6668` on the device indicates protocol
  3.3+; port `6666` indicates 3.1/3.2.
- Or run `python3 -m tinytuya scan` from a machine on the same LAN — it
  reports the version alongside the IP for every device it finds.

### 6. Add the device to `config/app.json`

```json
"tuya": {
  "devices": [
    {
      "name": "Fireplace",
      "id": "<device id from step 3>",
      "key": "<local key from step 3>",
      "ip": "<local ip from step 4>",
      "version": "<protocol version from step 5>"
    }
  ],
  "poll_interval_seconds": 60,
  "connect_timeout_milliseconds": 5000
}
```

### 7. Work out which DP maps to what you actually want to control

A device can expose many data points (DPs) beyond a single "switch" —
don't assume the DP literally named `switch` in the cloud schema is the
one you want. Verify against the physical device:

- Connect with a throwaway script using `tuyapi` and call
  `client.get({ schema: true })` to see the full current DP snapshot.
- Toggle one DP at a time with `client.set({ dps: N, set: true })`, watch
  what physically happens, and re-read the snapshot to see which key
  changed.
- **For the Onyx Avanti fireplace specifically**: DP `1` (`switch`) is the
  built-in heater; DP `10` (`light`) is the flame-effect light. This
  service is wired to DP `10` only — the heater is intentionally left
  unexposed.

## Notes

- `SWITCH_DPS` in `index.ts` is the DP index this service reads/writes.
  Update it (and the comment above it) if wiring up a different device or
  a different DP on the same device.
- The Tuya Cloud API credentials (Access ID/Secret) from step 2 aren't
  needed again once the local key is extracted — you can discard the
  cloud project, or leave it for future re-extraction if a device gets
  reset.
