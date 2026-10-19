import { MathUtils, Spherical, Vector3 } from 'three';

export function cameraFlight(from: Vector3, fromTarget: Vector3, to: Vector3, toTarget: Vector3) {
  const start = new Spherical().setFromVector3(from.clone().sub(fromTarget));
  const end = new Spherical().setFromVector3(to.clone().sub(toTarget));
  const angle = MathUtils.euclideanModulo(end.theta - start.theta + Math.PI, Math.PI * 2) - Math.PI;
  const origin = fromTarget.clone(), destination = toTarget.clone();
  return (progress: number) => {
    const t = MathUtils.clamp(progress, 0, 1), eased = t*t*t*(t*(t*6-15)+10);
    const target = origin.clone().lerp(destination, eased);
    const spherical = new Spherical(MathUtils.lerp(start.radius,end.radius,eased),MathUtils.lerp(start.phi,end.phi,eased),start.theta+angle*eased);
    return { target, position: new Vector3().setFromSpherical(spherical).add(target) };
  };
}
