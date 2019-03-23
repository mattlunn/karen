import { getAllUsers, getClientDevices } from './lib';
import config from '../../config';
import { User, Stay } from '../../models';
import { markUserAsAway, markUserAsHome } from '../../helpers/presence';
import nowAndSetInterval from '../../helpers/now-and-set-interval';

const TEN_MINUTES_IN_MS = 1000 * 60 * 10;

nowAndSetInterval(async () => {
  const [
    users,
    unifiUsers,
    unifiDevices
  ] = await Promise.all([
    User.findAll(),
    getAllUsers(),
    getClientDevices()
  ]);

  /*
    Example User (not updated while device is connected);
    {
      "_id": "5bd749e764bdf40417622869",
      "duration": 911250,
      "first_seen": 1540835815,
      "is_guest": false,
      "is_wired": true,
      "last_seen": 1541955338,
      "mac": "28:32:c5:08:98:17",
      "name": "BT Box - Lounge",
      "noted": true,
      "oui": "Humax",
      "rx_bytes": 77360319,
      "rx_packets": 651824,
      "site_id": "5bccb4bc64bdf404176212d2",
      "tx_bytes": 1686989533,
      "tx_packets": 1181593,
      "usergroup_id": ""
    }

    Example Device (disconnected devices not included);
    {
      "_id": "5bccc4b064bdf40417621328",
      "_is_guest_by_uap": false,
      "_is_guest_by_ugw": false,
      "_last_seen_by_uap": 1541955990,
      "_last_seen_by_ugw": 1541955985,
      "_uptime_by_uap": 15115,
      "_uptime_by_ugw": 160,
      "anomalies": 0,
      "ap_mac": "fc:ec:da:ac:19:e9",
      "assoc_time": 1541268792,
      "authorized": true,
      "blocked": false,
      "bssid": "fc:ec:da:ae:19:e9",
      "bytes-r": 0,
      "ccq": 333,
      "channel": 48,
      "dhcpend_time": 480,
      "essid": "UNIFI-HZP6",
      "first_seen": 1540146352,
      "fixed_ip": "192.168.1.73",
      "gw_mac": "fc:ec:da:d3:0f:66",
      "hostname": "09AA01AC26160RRB",
      "idletime": 32,
      "ip": "192.168.1.73",
      "is_11r": false,
      "is_guest": false,
      "is_wired": false,
      "last_seen": 1541955990,
      "latest_assoc_time": 1541955843,
      "mac": "18:b4:30:7e:20:2b",
      "name": "Nest Thermostat",
      "network": "LAN",
      "network_id": "5bccb4c164bdf404176212de",
      "noise": -103,
      "note": "",
      "noted": true,
      "oui": "NestLabs",
      "powersave_enabled": false,
      "qos_policy_applied": true,
      "radio": "na",
      "radio_name": "wifi1",
      "radio_proto": "na",
      "rssi": 48,
      "rx_bytes": 47343431,
      "rx_bytes-r": 0,
      "rx_packets": 139732,
      "rx_rate": 72200,
      "satisfaction": 85,
      "signal": -48,
      "site_id": "5bccb4bc64bdf404176212d2",
      "tx_bytes": 71775302,
      "tx_bytes-r": 0,
      "tx_packets": 149078,
      "tx_power": 34,
      "tx_rate": 72200,
      "uptime": 687198,
      "use_fixedip": false,
      "user_id": "5bccc4b064bdf40417621328",
      "usergroup_id": "",
      "vlan": 0
    }
  */

  for (const user of users) {
    if (user.device) {
      const unifiDevice = unifiDevices.find((unifiDevice) => unifiDevice.name === user.device);
      const unifiUser = unifiUsers.find((unifiUser) => unifiUser.name === user.device);
      const [ stay ] = await Stay.findCurrentOrLastStays([user.id]);
      const userHasRecentlyLeft = !!stay.departure && Date.now() - stay.departure < TEN_MINUTES_IN_MS;
      const userHasRecentlyArrived = !userHasRecentlyLeft && Date.now() - stay.arrival < TEN_MINUTES_IN_MS;

      if (unifiUser) {
        if (!userHasRecentlyLeft && !userHasRecentlyArrived) {
          const deviceIsHome = unifiDevice || Date.now() - (config.unifi.device_considered_gone_after_in_seconds * 1000) < (unifiUser.last_seen * 1000);
          const userIsHome = stay && stay.departure === null;

          if (deviceIsHome && !userIsHome) {
            console.log(`Forcing ${user.handle} to home, as their device is at home`);

            await markUserAsHome(user);
          } else if (!deviceIsHome && userIsHome) {
            console.log(`Forcing ${user.handle} to away, as their device has not been seen recently`);

            await markUserAsAway(user);
          }
        }
      } else {
        throw new Error(user.device + ' not found');
      }
    }
  }
}, config.unifi.device_check_interval_in_seconds * 1000);