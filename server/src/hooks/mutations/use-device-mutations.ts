import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeviceApiResponse } from '../../api/types';

export function useLightMutation(deviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { isOn?: boolean; brightness?: number }): Promise<DeviceApiResponse> => {
      const res = await fetch(`/api/device/${deviceId}/light`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update light: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['device', deviceId], data);
      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((device: any) =>
            device.id === deviceId ? data.device : device
          ),
        };
      });
    },
  });
}

export function useLockMutation(deviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { isLocked: boolean }): Promise<DeviceApiResponse> => {
      const res = await fetch(`/api/device/${deviceId}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update lock: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['device', deviceId], data);
      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((device: any) =>
            device.id === deviceId ? data.device : device
          ),
        };
      });
    },
  });
}

export function useThermostatMutation(deviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { targetTemperature: number }): Promise<DeviceApiResponse> => {
      const res = await fetch(`/api/device/${deviceId}/thermostat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update thermostat: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['device', deviceId], data);
      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((device: any) =>
            device.id === deviceId ? data.device : device
          ),
        };
      });
    },
  });
}
