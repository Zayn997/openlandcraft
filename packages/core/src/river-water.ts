import { z } from 'zod';

export const riverWaterSchema = z.object({
  amplitude: z.number().finite().min(0).max(0.4),
  wavelength: z.number().finite().min(1.5).max(12),
  foam: z.number().finite().min(0).max(1),
  foamPersistence: z.number().finite().min(1).max(20),
  wetBank: z.number().finite().min(0).max(1),
  dryingTime: z.number().finite().min(5).max(90),
}).strict();
export type RiverWater = z.infer<typeof riverWaterSchema>;
export const RIVER_WATER_DEFAULTS: RiverWater = {
  amplitude: 0.14, wavelength: 3.2, foam: 0.6,
  foamPersistence: 4, wetBank: 0.8, dryingTime: 20,
};
