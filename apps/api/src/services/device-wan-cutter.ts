/**
 * G90.10 BD.6 — device WAN cut, USB ADB stays.
 *
 * This is not airplane mode and not a USB-net cut. Those kill the control
 * channel and read as ENV_FAILURE. It is also not a host-side transport cut
 * (that is BD.2 HOST_TRANSPORT_CUT).
 *
 * `shell` is already device-scoped (`adb -s <serial> …`).
 */

export interface DeviceWanCutter {
  cut(): Promise<void>
  restore(): Promise<void>
}

export function createAdbDeviceWanCutter(input: {
  shell: (args: readonly string[]) => Promise<string>
}): DeviceWanCutter {
  const { shell } = input
  return {
    async cut() {
      await shell(['shell', 'svc', 'wifi', 'disable'])
      await shell(['shell', 'svc', 'data', 'disable'])
    },
    async restore() {
      await shell(['shell', 'svc', 'wifi', 'enable'])
      await shell(['shell', 'svc', 'data', 'enable'])
    },
  }
}
