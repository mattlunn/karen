import {
  faFire,
  faFaucet,
  faFaucetDrip,
  faTree,
  faThermometer2,
  faThermometer4,
  faGauge,
} from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';

export const heatPumpConfig: CapabilityUIConfig<'HEAT_PUMP'> = {
  type: 'HEAT_PUMP',
  icon: faFire,
  iconPriority: 15,

  getStatusItems: (capability) => [
    {
      icon: faFaucet,
      title: 'Hot Water CoP',
      value: `${capability.dHWCoP.value.toFixed(1)} CoP`,
      since: capability.dHWCoP.start,
      lastReported: capability.dHWCoP.lastReported,
    },
    {
      icon: faFire,
      title: 'Heating CoP',
      value: `${capability.heatingCoP.value.toFixed(1)} CoP`,
      since: capability.heatingCoP.start,
      lastReported: capability.heatingCoP.lastReported,
    },
    {
      icon: faTree,
      title: 'Outside Temperature',
      value: `${capability.outsideTemperature.value.toFixed(1)}°C`,
      since: capability.outsideTemperature.start,
      lastReported: capability.outsideTemperature.lastReported,
    },
    {
      icon: faFaucetDrip,
      title: 'Hot Water Temperature',
      value: `${capability.dhwTemperature.value.toFixed(1)}°C`,
      since: capability.dhwTemperature.start,
      lastReported: capability.dhwTemperature.lastReported,
    },
    {
      icon: faFire,
      title: 'Daily Yield',
      value: `${capability.dailyConsumedEnergy.value}kWh`,
      since: capability.dailyConsumedEnergy.start,
      lastReported: capability.dailyConsumedEnergy.lastReported,
    },
    {
      icon: faThermometer4,
      title: 'Flow Temperature',
      value: `${capability.actualFlowTemperature.value.toFixed(1)}°C`,
      since: capability.actualFlowTemperature.start,
      lastReported: capability.actualFlowTemperature.lastReported,
    },
    {
      icon: faThermometer2,
      title: 'Return Temperature',
      value: `${capability.returnTemperature.value.toFixed(1)}°C`,
      since: capability.returnTemperature.start,
      lastReported: capability.returnTemperature.lastReported,
    },
    {
      icon: faGauge,
      title: 'System Pressure',
      value: `${capability.systemPressure.value.toFixed(1)} bar`,
      since: capability.systemPressure.start,
      lastReported: capability.systemPressure.lastReported,
    },
  ],

  getGroupControlProps: (capability) => ({
    icon: faFire,
    color: '#04A7F4',
    colorIconBackground: capability.mode.value !== 'STANDBY',
    values: [
      `${capability.mode.value[0]}${capability.mode.value.slice(1).toLowerCase()}`,
      `${capability.dailyConsumedEnergy.value}kW`,
      `${capability.heatingCoP.value} CoP`,
      `${capability.compressorModulation.value}%`,
    ],
  }),

  graphs: [
    { id: 'heatpump-power', title: 'Power' },
    { id: 'heatpump-outside-temp', title: 'Outside Temperature', yMin: -10 },
    { id: 'heatpump-dhw-temp', title: 'DHW Temperature' },
    { id: 'heatpump-flow-temp', title: 'Flow/ Return Temperatures' },
    {
      id: 'heatpump-pressure',
      title: 'System Pressure',
      zones: [
        { min: 0, max: 1, color: 'rgba(255, 0, 55, 0.25)' },
        { min: 1, max: 2, color: 'rgba(31, 135, 0, 0.25)' },
      ],
      yMin: 0,
      yMax: 2,
    },
  ],
};
