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
    onMutate: async (newData) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['device', deviceId] });
      await queryClient.cancelQueries({ queryKey: ['devices'] });

      // Snapshot current state
      const previousDevice = queryClient.getQueryData(['device', deviceId]);
      const previousDevices = queryClient.getQueryData(['devices']);

      // Optimistically update device cache
      queryClient.setQueryData(['device', deviceId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          device: {
            ...old.device,
            capabilities: old.device.capabilities.map((cap: any) => {
              if (cap.type !== 'LIGHT') return cap;

              return {
                ...cap,
                ...(newData.isOn !== undefined && {
                  isOn: { ...cap.isOn, value: newData.isOn }
                }),
                ...(newData.brightness !== undefined && {
                  brightness: { ...cap.brightness, value: newData.brightness }
                }),
              };
            }),
          },
        };
      });

      // Optimistically update devices list cache
      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((device: any) => {
            if (device.id !== deviceId) return device;

            return {
              ...device,
              capabilities: device.capabilities.map((cap: any) => {
                if (cap.type !== 'LIGHT') return cap;

                return {
                  ...cap,
                  ...(newData.isOn !== undefined && {
                    isOn: { ...cap.isOn, value: newData.isOn }
                  }),
                  ...(newData.brightness !== undefined && {
                    brightness: { ...cap.brightness, value: newData.brightness }
                  }),
                };
              }),
            };
          }),
        };
      });

      return { previousDevice, previousDevices };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      if (context?.previousDevice) {
        queryClient.setQueryData(['device', deviceId], context.previousDevice);
      }
      if (context?.previousDevices) {
        queryClient.setQueryData(['devices'], context.previousDevices);
      }
      console.error('Light mutation failed:', err);
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(['device', deviceId], data);

      // Update devices list
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
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['device', deviceId] });
      await queryClient.cancelQueries({ queryKey: ['devices'] });

      const previousDevice = queryClient.getQueryData(['device', deviceId]);
      const previousDevices = queryClient.getQueryData(['devices']);

      // Optimistic updates
      queryClient.setQueryData(['device', deviceId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          device: {
            ...old.device,
            capabilities: old.device.capabilities.map((cap: any) => {
              if (cap.type !== 'LOCK') return cap;
              return {
                ...cap,
                isLocked: { ...cap.isLocked, value: newData.isLocked }
              };
            }),
          },
        };
      });

      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((device: any) => {
            if (device.id !== deviceId) return device;
            return {
              ...device,
              capabilities: device.capabilities.map((cap: any) => {
                if (cap.type !== 'LOCK') return cap;
                return {
                  ...cap,
                  isLocked: { ...cap.isLocked, value: newData.isLocked }
                };
              }),
            };
          }),
        };
      });

      return { previousDevice, previousDevices };
    },
    onError: (err, newData, context) => {
      if (context?.previousDevice) {
        queryClient.setQueryData(['device', deviceId], context.previousDevice);
      }
      if (context?.previousDevices) {
        queryClient.setQueryData(['devices'], context.previousDevices);
      }
      console.error('Lock mutation failed:', err);
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
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['device', deviceId] });
      await queryClient.cancelQueries({ queryKey: ['devices'] });

      const previousDevice = queryClient.getQueryData(['device', deviceId]);
      const previousDevices = queryClient.getQueryData(['devices']);

      queryClient.setQueryData(['device', deviceId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          device: {
            ...old.device,
            capabilities: old.device.capabilities.map((cap: any) => {
              if (cap.type !== 'THERMOSTAT') return cap;
              return {
                ...cap,
                targetTemperature: { ...cap.targetTemperature, value: newData.targetTemperature }
              };
            }),
          },
        };
      });

      queryClient.setQueryData(['devices'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((device: any) => {
            if (device.id !== deviceId) return device;
            return {
              ...device,
              capabilities: device.capabilities.map((cap: any) => {
                if (cap.type !== 'THERMOSTAT') return cap;
                return {
                  ...cap,
                  targetTemperature: { ...cap.targetTemperature, value: newData.targetTemperature }
                };
              }),
            };
          }),
        };
      });

      return { previousDevice, previousDevices };
    },
    onError: (err, newData, context) => {
      if (context?.previousDevice) {
        queryClient.setQueryData(['device', deviceId], context.previousDevice);
      }
      if (context?.previousDevices) {
        queryClient.setQueryData(['devices'], context.previousDevices);
      }
      console.error('Thermostat mutation failed:', err);
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
