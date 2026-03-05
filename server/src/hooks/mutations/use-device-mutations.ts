import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeviceApiResponse, LightUpdateRequest, LockUpdateRequest, ThermostatUpdateRequest, VehicleUpdateRequest } from '../../api/types';

export function useLightMutation(deviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LightUpdateRequest): Promise<DeviceApiResponse> => {
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
    mutationFn: async (data: LockUpdateRequest): Promise<DeviceApiResponse> => {
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
    mutationFn: async (data: ThermostatUpdateRequest): Promise<DeviceApiResponse> => {
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

export function useVehicleMutation(deviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VehicleUpdateRequest): Promise<DeviceApiResponse> => {
      const res = await fetch(`/api/device/${deviceId}/vehicle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to update vehicle: ${res.status}`);
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
