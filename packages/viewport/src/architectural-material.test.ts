import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {ARCHITECTURAL_MATERIAL_DEFAULTS} from '@openlandcraft/core';
import {buildArchitecturalMaterial} from './architectural-material';
describe('architecture surface projection',()=>{
 it('keeps plain object appearance until assigned and retains stair landing depth handling',()=>{
  const m=buildArchitecturalMaterial(undefined,'#123456',true);expect(m.color.getHexString()).toBe('123456');expect(m.roughness).toBe(.8);expect(m.polygonOffset).toBe(true);m.dispose();
 });
 it('projects each built-in at metre scale across arbitrary geometry independently of authored UVs',()=>{
  for(const [index,definition] of ARCHITECTURAL_MATERIAL_DEFAULTS.entries()){
   const m=buildArchitecturalMaterial(definition),shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader as Parameters<typeof m.onBeforeCompile>[0],{} as THREE.WebGLRenderer);
   expect(shader.uniforms).toMatchObject({uCastleScale:{value:definition.scale},uCastlePattern:{value:index}});expect(shader.vertexShader).toContain('modelMatrix*vec4(position,1.0)');expect(shader.fragmentShader).toContain('vCastlePosition/uCastleScale');expect(shader.fragmentShader).toContain('diffuseColor.rgb*=castleDetail.x');expect(shader.fragmentShader).toContain('normal=castleBump');expect(m.roughness).toBe(definition.roughness);expect(m.color.getHexString()).toBe(definition.color.slice(1));m.dispose();
  }
 });
});
