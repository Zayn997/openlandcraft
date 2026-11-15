import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { mirrorPreviewModel } from './mirror-preview';

describe('mirrored model previews', () => {
  it('isolates translucent preview materials from originals and keeps borrowed geometry alive', () => {
    const source = new Group(), geometry = new BoxGeometry(), original = new MeshStandardMaterial({ color: '#668844' });
    const mesh = new Mesh(geometry, original); mesh.userData.plantWind = true; source.add(mesh);
    const disposeOriginal = vi.spyOn(original, 'dispose'), disposeGeometry = vi.spyOn(geometry, 'dispose');
    const preview = mirrorPreviewModel(source), copy = preview.object.children[0] as Mesh;
    expect(copy.geometry).toBe(geometry); expect(copy.material).not.toBe(original);
    expect(copy.material).toMatchObject({ transparent: true, opacity: 0.38, depthWrite: false });
    expect(original).toMatchObject({ transparent: false, opacity: 1, depthWrite: true });
    expect(mesh.userData.plantWind).toBe(true); expect(copy.userData.plantWind).toBeUndefined();
    preview.dispose(); expect(disposeOriginal).not.toHaveBeenCalled(); expect(disposeGeometry).not.toHaveBeenCalled();
    geometry.dispose(); original.dispose();
  });
});
