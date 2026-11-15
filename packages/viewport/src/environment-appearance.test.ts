import { describe, expect, it } from 'vitest';
import { createSite, DEFAULT_ENVIRONMENT } from '@openlandcraft/core';
import { environmentAppearance, seasonalSite } from './environment-appearance';

describe('environment appearance', () => {
  it('changes seasonal terrain colors without changing authored colors or terrain heights', () => {
    const site=createSite({name:'Season',width:60,depth:60,resolution:129,preset:'flat'}).site, original=structuredClone(site.materials);
    expect(seasonalSite(site)).toBe(site);expect(seasonalSite(site,DEFAULT_ENVIRONMENT)).toBe(site);
    const autumn=seasonalSite(site,{...DEFAULT_ENVIRONMENT,season:'autumn'}),snow=seasonalSite(site,{...DEFAULT_ENVIRONMENT,weather:'snow'});
    expect(autumn.materials.grass).not.toBe(site.materials.grass);expect(snow.materials.grass).not.toBe(autumn.materials.grass);
    expect(autumn.terrain).toBe(site.terrain);expect(site.materials).toEqual(original);
  });
  it('reduces direct light under cloud cover and adds fog only for weather presets', () => {
    const clear=environmentAppearance(),cloud=environmentAppearance({...DEFAULT_ENVIRONMENT,weather:'cloudy'}),fog=environmentAppearance({...DEFAULT_ENVIRONMENT,weather:'fog'});
    expect(clear.fog).toBe(0);expect(cloud.direct).toBeLessThan(clear.direct);expect(cloud.ambient).toBeGreaterThan(clear.ambient);expect(fog.fog).toBeGreaterThan(cloud.fog);
    expect(environmentAppearance({...DEFAULT_ENVIRONMENT,sunElevation:5}).sun.b).toBeLessThan(clear.sun.b);
  });
});
