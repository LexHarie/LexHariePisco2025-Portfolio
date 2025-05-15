import * as CANNON from 'cannon-es';

export function initPhysics() {
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  return world;
}