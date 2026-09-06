# appliance-panel

ESPHome firmware for the Elecrow CrowPanel ESP32 5.79" e-paper display
(792 × 272, mono). The panel fetches a pre-rendered PNG from karen every
30 minutes and draws it. All layout and logic lives in karen — this config
just pulls an image and puts it on screen.

## Setup

Requires ESPHome. Install with pipx rather than plain pip:

```bash
brew install pipx
pipx ensurepath
pipx install esphome
```

Create `secrets.yaml` in this directory (gitignored — see
`secrets.yaml.example`):

```yaml
wifi_ssid: "..."
wifi_password: "..."
panel_url: "https://<host>/panel.png"
api_key: "..."       # openssl rand -base64 32
ota_password: "..."
```

## Flashing over USB

Only needed for the first flash, or to recover a device that won't come up
on the network.

1. Connect the panel to the Mac with a **USB-C data cable** (charge-only
   cables will power the board but no serial port will appear).
2. Leave the **BAT connector empty**. With a battery attached, the USB serial
   port does not enumerate at all on macOS.
3. Confirm the port is visible:

   ```bash
   ls /dev/cu.*
   ```

   Look for `/dev/cu.usbserial-*`.

4. Flash:

   ```bash
   esphome run appliance-panel.yaml --device /dev/cu.usbserial-210
   ```

   Substitute the port from step 3.

If the upload can't sync, hold **BOOT**, tap **RESET**, release **BOOT**, and
run again.

The first build downloads the ESP-IDF toolchain and takes several minutes.
Subsequent builds are much faster.

## Flashing over the air

Once the device is on the network, drop the `--device` flag:

```bash
esphome run appliance-panel.yaml
```

ESPHome finds it by hostname and pushes the firmware over Wi-Fi.

## Logs

The `api:` block enables ESPHome's native protocol, which streams logs over
the network:

```bash
esphome logs appliance-panel.yaml
```

This is the main debugging tool once the panel is mounted. Watch for:

- `online_image` download attempts and their result — a 404, a TLS failure or
  a size mismatch all show up here
- Display refresh messages from `crowpanel_epaper`
- Wi-Fi connection state

Over USB instead, if the device isn't reachable:

```bash
esphome logs appliance-panel.yaml --device /dev/cu.usbserial-210
```

`api:` also lets Home Assistant adopt the device, which exposes the panel's
diagnostics (uptime, Wi-Fi signal) as entities. Optional, but it gives a
second way to spot a panel that's silently stopped updating.

**Note:** if the device is *not* added to Home Assistant, `api:` reboots it
after 15 minutes with no client connected. Either adopt it in HA, or set
`reboot_timeout: 0s` under `api:`.

## Gotchas

- **GPIO7 gates the panel's power rail.** The `on_boot` block driving
  `epd_power` high is required — without it the screen stays blank and it
  looks identical to a wrong pin mapping.
- **The PNG must be exactly 792 × 272, 1-bit, no alpha.** `online_image`
  does not scale.
- **E-ink holds its last image.** A blank or stale screen after a flash
  usually means no successful download has happened yet, not a display fault.
  Check the logs.
- **If the image renders inverted**, flip `invert_colors` in the display
  block rather than changing karen's renderer.
- Build warnings from the `crowpanel_epaper` external component (`%u` vs
  `%lu` format strings) are cosmetic and can be ignored.