import { Device } from '@capacitor/device';
import { isNativeApp } from './platform';

/** The phone's manufacturer in lower case ("xiaomi", "samsung"), or null in a browser. */
export async function manufacturer(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    return (await Device.getInfo()).manufacturer.toLowerCase();
  } catch {
    return null;
  }
}
