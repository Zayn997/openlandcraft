import { z } from 'zod';

export const environmentSchema = z.object({
  season: z.enum(['spring', 'summer', 'autumn', 'winter']),
  weather: z.enum(['clear', 'cloudy', 'rain', 'snow', 'fog']),
  sunAzimuth: z.number().finite().min(0).max(360),
  sunElevation: z.number().finite().min(0).max(90),
}).strict();
export type SceneEnvironment = z.infer<typeof environmentSchema>;
export const DEFAULT_ENVIRONMENT: SceneEnvironment = { season: 'summer', weather: 'clear', sunAzimuth: 222, sunElevation: 49 };

/** Azimuth is clockwise from north (-Z); elevation is above the horizon. */
export function sunDirection(environment: SceneEnvironment): [number, number, number] {
  const azimuth = environment.sunAzimuth * Math.PI / 180, elevation = environment.sunElevation * Math.PI / 180;
  return [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation)];
}
