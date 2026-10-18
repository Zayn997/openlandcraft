import { describe, expect, it } from 'vitest';
import { createOcean, createRiver, createSite, evaluateProject } from '@openlandcraft/core';
import { riverMouth } from './river-mouth';

describe('bounded river mouth blending', () => {
  it('requires visible ocean, a sea-level endpoint and submerged evaluated ground', () => {
    const project = createSite({ name:'Join', width:90, depth:72, resolution:129, preset:'flat' });
    const ocean = createOcean('ocean'), river = { ...createRiver(project), points:[[-15,0,-15],[-10,0,0],[10,0,15]] as [number,number,number][] };
    project.entities = [river, ocean]; const site = evaluateProject(project).site;
    const mouth = riverMouth(river, site, ocean);
    expect(mouth.enabled).toBe(true); expect(mouth.end - mouth.start).toBe(8);
    expect(riverMouth(river, site).enabled).toBe(false);
    expect(riverMouth(river, site, { ...ocean, visible:false }).enabled).toBe(false);
    expect(riverMouth(river, site, { ...ocean, level:2 }).enabled).toBe(false);
    expect(riverMouth(river, project.site, ocean).enabled).toBe(false);
  });
});
