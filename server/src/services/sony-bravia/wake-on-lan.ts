import dgram from 'dgram';

// Wake-on-LAN magic packet: six 0xFF bytes followed by the target MAC
// repeated 16 times, sent to the broadcast address on UDP port 9.
export default function wakeOnLan(mac: string): Promise<void> {
  const bytes = mac.split(':').map(h => parseInt(h, 16));

  if (bytes.length !== 6 || bytes.some(b => Number.isNaN(b))) {
    return Promise.reject(new Error(`Invalid MAC address "${mac}"`));
  }

  const macBuffer = Buffer.from(bytes);
  const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(macBuffer)]);

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');

    socket.once('error', (err) => {
      socket.close();
      reject(err);
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 9, '255.255.255.255', (err) => {
        socket.close();

        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}
