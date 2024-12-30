import React from 'react';
import Room from './room';
import { faBed, faKitchenSet, faCouch, faStairs, faLightbulb, faTemperatureHigh, faPersonRunning, faWindowMaximize } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ThermostatHeatMap from './thermostat-heat-map';

const activity = [
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735516800000,
      "end": 1735517100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735517100000,
      "end": 1735517400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735517400000,
      "end": 1735517700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735517700000,
      "end": 1735518000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735518000000,
      "end": 1735518300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735518300000,
      "end": 1735518600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735518600000,
      "end": 1735518900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735518900000,
      "end": 1735519200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735519200000,
      "end": 1735519500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735519500000,
      "end": 1735519800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735519800000,
      "end": 1735520100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735520100000,
      "end": 1735520400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735520400000,
      "end": 1735520700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735520700000,
      "end": 1735521000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735521000000,
      "end": 1735521300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735521300000,
      "end": 1735521600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735521600000,
      "end": 1735521900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735521900000,
      "end": 1735522200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735522200000,
      "end": 1735522500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735522500000,
      "end": 1735522800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735522800000,
      "end": 1735523100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735523100000,
      "end": 1735523400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735523400000,
      "end": 1735523700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735523700000,
      "end": 1735524000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735524000000,
      "end": 1735524300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735524300000,
      "end": 1735524600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735524600000,
      "end": 1735524900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735524900000,
      "end": 1735525200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735525200000,
      "end": 1735525500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735525500000,
      "end": 1735525800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735525800000,
      "end": 1735526100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735526100000,
      "end": 1735526400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735526400000,
      "end": 1735526700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735526700000,
      "end": 1735527000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735527000000,
      "end": 1735527300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735527300000,
      "end": 1735527600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735527600000,
      "end": 1735527900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735527900000,
      "end": 1735528200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735528200000,
      "end": 1735528500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735528500000,
      "end": 1735528800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735528800000,
      "end": 1735529100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735529100000,
      "end": 1735529400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": false
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735529400000,
      "end": 1735529700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735529700000,
      "end": 1735530000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735530000000,
      "end": 1735530300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735530300000,
      "end": 1735530600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735530600000,
      "end": 1735530900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735530900000,
      "end": 1735531200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735531200000,
      "end": 1735531500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735531500000,
      "end": 1735531800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735531800000,
      "end": 1735532100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735532100000,
      "end": 1735532400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735532400000,
      "end": 1735532700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735532700000,
      "end": 1735533000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735533000000,
      "end": 1735533300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735533300000,
      "end": 1735533600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735533600000,
      "end": 1735533900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735533900000,
      "end": 1735534200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735534200000,
      "end": 1735534500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735534500000,
      "end": 1735534800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735534800000,
      "end": 1735535100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735535100000,
      "end": 1735535400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735535400000,
      "end": 1735535700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735535700000,
      "end": 1735536000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735536000000,
      "end": 1735536300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735536300000,
      "end": 1735536600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735536600000,
      "end": 1735536900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735536900000,
      "end": 1735537200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735537200000,
      "end": 1735537500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735537500000,
      "end": 1735537800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735537800000,
      "end": 1735538100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735538100000,
      "end": 1735538400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735538400000,
      "end": 1735538700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735538700000,
      "end": 1735539000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735539000000,
      "end": 1735539300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735539300000,
      "end": 1735539600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735539600000,
      "end": 1735539900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735539900000,
      "end": 1735540200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735540200000,
      "end": 1735540500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735540500000,
      "end": 1735540800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735540800000,
      "end": 1735541100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735541100000,
      "end": 1735541400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735541400000,
      "end": 1735541700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735541700000,
      "end": 1735542000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735542000000,
      "end": 1735542300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735542300000,
      "end": 1735542600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735542600000,
      "end": 1735542900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735542900000,
      "end": 1735543200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735543200000,
      "end": 1735543500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735543500000,
      "end": 1735543800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735543800000,
      "end": 1735544100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735544100000,
      "end": 1735544400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735544400000,
      "end": 1735544700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735544700000,
      "end": 1735545000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735545000000,
      "end": 1735545300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735545300000,
      "end": 1735545600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735545600000,
      "end": 1735545900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735545900000,
      "end": 1735546200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735546200000,
      "end": 1735546500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735546500000,
      "end": 1735546800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735546800000,
      "end": 1735547100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735547100000,
      "end": 1735547400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735547400000,
      "end": 1735547700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735547700000,
      "end": 1735548000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735548000000,
      "end": 1735548300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735548300000,
      "end": 1735548600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735548600000,
      "end": 1735548900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735548900000,
      "end": 1735549200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735549200000,
      "end": 1735549500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735549500000,
      "end": 1735549800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735549800000,
      "end": 1735550100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735550100000,
      "end": 1735550400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735550400000,
      "end": 1735550700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735550700000,
      "end": 1735551000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735551000000,
      "end": 1735551300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735551300000,
      "end": 1735551600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735551600000,
      "end": 1735551900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735551900000,
      "end": 1735552200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735552200000,
      "end": 1735552500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735552500000,
      "end": 1735552800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735552800000,
      "end": 1735553100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735553100000,
      "end": 1735553400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735553400000,
      "end": 1735553700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735553700000,
      "end": 1735554000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735554000000,
      "end": 1735554300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735554300000,
      "end": 1735554600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735554600000,
      "end": 1735554900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735554900000,
      "end": 1735555200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735555200000,
      "end": 1735555500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735555500000,
      "end": 1735555800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735555800000,
      "end": 1735556100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735556100000,
      "end": 1735556400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735556400000,
      "end": 1735556700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735556700000,
      "end": 1735557000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735557000000,
      "end": 1735557300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735557300000,
      "end": 1735557600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735557600000,
      "end": 1735557900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735557900000,
      "end": 1735558200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735558200000,
      "end": 1735558500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735558500000,
      "end": 1735558800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735558800000,
      "end": 1735559100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735559100000,
      "end": 1735559400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735559400000,
      "end": 1735559700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735559700000,
      "end": 1735560000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735560000000,
      "end": 1735560300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735560300000,
      "end": 1735560600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735560600000,
      "end": 1735560900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735560900000,
      "end": 1735561200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735561200000,
      "end": 1735561500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735561500000,
      "end": 1735561800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735561800000,
      "end": 1735562100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735562100000,
      "end": 1735562400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735562400000,
      "end": 1735562700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735562700000,
      "end": 1735563000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735563000000,
      "end": 1735563300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735563300000,
      "end": 1735563600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735563600000,
      "end": 1735563900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735563900000,
      "end": 1735564200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735564200000,
      "end": 1735564500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735564500000,
      "end": 1735564800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735564800000,
      "end": 1735565100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735565100000,
      "end": 1735565400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735565400000,
      "end": 1735565700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735565700000,
      "end": 1735566000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735566000000,
      "end": 1735566300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735566300000,
      "end": 1735566600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735566600000,
      "end": 1735566900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735566900000,
      "end": 1735567200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735567200000,
      "end": 1735567500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735567500000,
      "end": 1735567800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735567800000,
      "end": 1735568100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735568100000,
      "end": 1735568400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735568400000,
      "end": 1735568700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735568700000,
      "end": 1735569000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735569000000,
      "end": 1735569300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735569300000,
      "end": 1735569600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735569600000,
      "end": 1735569900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735569900000,
      "end": 1735570200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735570200000,
      "end": 1735570500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735570500000,
      "end": 1735570800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735570800000,
      "end": 1735571100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735571100000,
      "end": 1735571400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735571400000,
      "end": 1735571700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735571700000,
      "end": 1735572000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735572000000,
      "end": 1735572300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735572300000,
      "end": 1735572600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735572600000,
      "end": 1735572900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735572900000,
      "end": 1735573200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735573200000,
      "end": 1735573500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735573500000,
      "end": 1735573800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735573800000,
      "end": 1735574100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735574100000,
      "end": 1735574400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735574400000,
      "end": 1735574700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735574700000,
      "end": 1735575000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735575000000,
      "end": 1735575300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735575300000,
      "end": 1735575600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735575600000,
      "end": 1735575900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735575900000,
      "end": 1735576200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735576200000,
      "end": 1735576500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735576500000,
      "end": 1735576800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735576800000,
      "end": 1735577100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735577100000,
      "end": 1735577400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735577400000,
      "end": 1735577700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735577700000,
      "end": 1735578000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735578000000,
      "end": 1735578300000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735578300000,
      "end": 1735578600000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735578600000,
      "end": 1735578900000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735578900000,
      "end": 1735579200000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735579200000,
      "end": 1735579500000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735579500000,
      "end": 1735579800000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735579800000,
      "end": 1735580100000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735580100000,
      "end": 1735580400000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735580400000,
      "end": 1735580700000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  },
  {
    "__typename": "HistoryDatum",
    "period": {
      "__typename": "TimePeriod",
      "start": 1735580700000,
      "end": 1735581000000
    },
    "datum": {
      "__typename": "Thermostat",
      "isHeating": true
    }
  }
];

function DeviceControl({ icon, iconColor, name, values, showMap }) {
  return (
    <>
      <div className="device-control__header">
        <div className="device-control__icon-container" style={{ backgroundColor: iconColor + '50' }}>
          <FontAwesomeIcon icon={icon} color={iconColor} />
        </div>
        <div className="device-control__body">
          <h4 className="device-control__name">{name}</h4>
          <ul className="device-control__values">
            {values.map(value => <li className="device-control__value">{value}</li>)}
          </ul>
        </div>
      </div>
      <div className="device-control__footer">
        {showMap && <ThermostatHeatMap activity={activity} withHours={false} colorMask={iconColor} />}
      </div>
    </>
  );
}

export default function Rooms() {
  return (
    <ul className="room-list">
      <li className="room">
        <Room name="Kitchen" icon={faKitchenSet}>
          <DeviceControl name="Light" icon={faLightbulb} iconColor="#ffa24d" values={["On", "95%"]} showMap={true} />
          <DeviceControl name="Temperature" icon={faTemperatureHigh} iconColor="#ff6f22" values={["21°", "50%", "7hr"]} showMap={true} />
        </Room>
      </li>
      <li className="room">
        <Room name="Living Room" icon={faCouch}>
          <DeviceControl name="Light" icon={faLightbulb} iconColor="#ffa24d" values={["On", "95%"]} showMap={true} />
          <DeviceControl name="Temperature" icon={faTemperatureHigh} iconColor="#ff6f22" values={["19.5°", "2%", "2.5hr"]} showMap={true} />
        </Room>
      </li>
      <li className="room">
        <Room name="Hallway" icon={faStairs}>
          <DeviceControl name="Light" icon={faLightbulb} iconColor="#ffa24d" values={["On", "95%"]} showMap={true} />
          <DeviceControl name="Temperature" icon={faTemperatureHigh} iconColor="#ff6f22" values={["20°", "0%", "3hr"]} showMap={true} />
          <DeviceControl name="Motion" icon={faPersonRunning} iconColor="#57c5f7" values={["now"]} showMap={true} />
        </Room>
      </li>
      <li className="room">
        <Room name="Master Bedroom" icon={faBed}>
          <DeviceControl name="Light" icon={faLightbulb} iconColor="#ffa24d" values={["On", "95%"]} showMap={true} />
          <DeviceControl name="Bedside Light" icon={faLightbulb} iconColor="#ffa24d" values={["On", "95%"]} showMap={true} />
          <DeviceControl name="Wardrobe Light" icon={faLightbulb} iconColor="#ffa24d" values={["On", "95%"]} showMap={true} />
          <DeviceControl name="Temperature" icon={faTemperatureHigh} iconColor="#ff6f22" values={["15°", "100%", "7hr"]} showMap={true} />
          <DeviceControl name="Curtains" icon={faWindowMaximize} iconColor="#ff6f22" values={["Open"]}/>
        </Room>
      </li>
    </ul>
  );
}