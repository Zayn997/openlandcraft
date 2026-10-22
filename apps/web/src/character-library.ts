import { encodeGlb, inspectGlb, type Asset } from '@openlandcraft/core';

export const CHARACTERS = [
  {id:'horse',name:'Horse',category:'Animals',height:2.1,url:'/models/characters/horse.glb',thumbnail:'/models/characters/horse.png'},
  {id:'person-male',name:'Person · blue shirt',category:'People',height:1.78,url:'/models/characters/person-male.glb',thumbnail:'/models/characters/person-male.png'},
  {id:'person-female',name:'Person · rust shirt',category:'People',height:1.68,url:'/models/characters/person-female.glb',thumbnail:'/models/characters/person-female.png'},
] as const;
export type LibraryCharacter = typeof CHARACTERS[number];
export const CHARACTER_CREDIT = 'Quaternius · CC0-1.0 · https://opengameart.org/content/animated-characters-pack · Casual people; materials and Idle/Walk exports prepared in Blender for OpenLandcraft.';
export const HORSE_CREDIT = 'Quaternius · CC0-1.0 · https://opengameart.org/content/lowpoly-animated-farm-animal-pack · Horse; materials and Idle/Walk exports prepared in Blender for OpenLandcraft.';
export async function loadLibraryCharacter(character: LibraryCharacter, signal: AbortSignal): Promise<Asset> {
  const response = await fetch(character.url,{signal});
  if (!response.ok) throw new Error(`${character.name} could not load. Try again.`);
  const bytes = new Uint8Array(await response.arrayBuffer()); inspectGlb(bytes);
  return {id:`cc0-character-${character.id}-v1`,name:character.name,data:encodeGlb(bytes),attribution:character.category === 'Animals' ? HORSE_CREDIT : CHARACTER_CREDIT};
}
