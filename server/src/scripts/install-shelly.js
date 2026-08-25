import { createInterface } from 'readline/promises';
import { installWifiDevice, installBluSensor, installPresenceZones } from '../services/shelly/install';

const DEVICE_TYPES = [
  { label: 'Switch / Plug', kind: 'wifi' },
  { label: 'Dimmer', kind: 'wifi' },
  { label: 'Fire alarm sensor', kind: 'wifi' },
  { label: 'Presence sensor (motion, multi-zone)', kind: 'presence' },
  { label: 'BLU door/window sensor (via BLE gateway)', kind: 'blu' },
];

// installWifiDevice() ends with a reboot, so the device is briefly unreachable straight
// afterwards - retry until it's back up rather than surfacing a spurious connection error.
async function withRetries(fn, attempts = 10, delayMs = 3000) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('What are you installing?');
    DEVICE_TYPES.forEach((type, i) => console.log(`  ${i + 1}) ${type.label}`));

    const choice = Number(await rl.question('> '));
    const type = DEVICE_TYPES[choice - 1];

    if (!type) {
      console.log('Not a valid choice');
      process.exit(1);
    }

    if (type.kind === 'wifi') {
      const ip = await rl.question('IP address: ');
      const device = await installWifiDevice(ip);

      console.log(`Installed device ${device.id} (${device.model}) as "${device.name}"`);
    } else if (type.kind === 'presence') {
      const ip = await rl.question('IP address: ');
      const device = await installWifiDevice(ip);

      console.log(`Installed device ${device.id} (${device.model}) as "${device.name}"`);
      console.log('Waiting for the device to come back online after reboot...');

      const withZones = await withRetries(() => installPresenceZones(ip));
      const zones = withZones.meta.zones;

      console.log(`Detected ${zones.length} zone(s) from the device: ${zones.map((zone) => zone.name).join(', ')}`);
    } else if (type.kind === 'blu') {
      const ip = await rl.question('Gateway IP address: ');
      const mac = await rl.question('Sensor BLE MAC: ');
      const name = await rl.question('Name: ');
      const device = await installBluSensor(ip, mac, name);

      console.log(`Installed device ${device.id} (${device.model}) as "${device.name}"`);
    }
  } finally {
    rl.close();
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.log(err);
  process.exit(1);
});
