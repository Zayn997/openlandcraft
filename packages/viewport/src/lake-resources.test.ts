import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createLake,createSite} from '@openlandcraft/core';
import {LakeHistory} from './lake-water';
import {lakeUniforms,updateLakeUniforms} from './lake-system';

describe('lake resource release',()=>{
  it('removes disposed samplers from retained terrain/ocean uniforms when a lake disappears',()=>{
    const project=createSite({name:'Lake lifecycle',width:40,depth:40,resolution:129,preset:'flat'}),lake=createLake(project,[[-8,-8],[8,-8],[8,8],[-8,8]]);
    const fallback=new THREE.Texture(),uniforms=lakeUniforms(fallback);
    // A terrain material survives changing/opening projects; its uniform objects remain shared.
    const retained={...uniforms};
    for(let cycle=0;cycle<3;cycle++){
      const resources={simulation:new LakeHistory(project.site,lake),history:new THREE.DataTexture(),distance:new THREE.DataTexture()};
      updateLakeUniforms(uniforms,resources,fallback);
      expect(retained.uLakeHistory.value).toBe(resources.history);expect(retained.uLakeEnabled.value).toBe(1);
      resources.history.dispose();resources.distance.dispose();
      updateLakeUniforms(uniforms,null,fallback);
      expect(retained.uLakeHistory.value).toBe(fallback);expect(retained.uLakeDistance.value).toBe(fallback);
      expect(retained.uLakeEnabled.value).toBe(0);expect(retained.uLakeWetBank.value).toBe(0);
    }
    fallback.dispose();
  });
});
