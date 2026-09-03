import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeviceApiResponse, LightUpdateRequest, LockUpdateRequest, ThermostatUpdateRequest, VehicleUpdateRequest, DishwasherUpdateRequest } from '../../api/types';

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

export function useDishwasherMutation(deviceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DishwasherUpdateRequest): Promise<DeviceApiResponse> => {
      const res = await fetch(`/api/device/${deviceId}/dishwasher`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // The appliance's own refusals (no program selected, remote start not
        // enabled) and an unpriced horizon come back as a message worth showing.
        const body = await res.json().catch(() => null);

        throw new Error(body?.error ?? `Failed to update dishwasher: ${res.status}`);
      }

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
