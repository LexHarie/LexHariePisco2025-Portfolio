import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function loadAssets(scene, world) {
  const loader = new GLTFLoader();

  // Load pirate island environment (served from public/models)
  // Use BASE_URL to ensure correct path in dev and production
  const islandData = await loader.loadAsync(
    '/models/pirate_island.glb'
  );
  const island = islandData.scene;
  island.position.set(0, 0, 0);
  scene.add(island);

  // Load treasure chest model
  // Note: model filename is greedy_octopuss_treasure_chest.glb in public/models
  const chestData = await loader.loadAsync(
    '/models/greedy_octopuss_treasure_chest.glb'
  );
  const baseChest = chestData.scene;
  const chests = [];

  // Example project positions
  const projectPositions = [
    { x: 5, y: 0, z: -5, key: 'project1' },
    { x: -8, y: 0, z: 4, key: 'project2' }
  ];

  projectPositions.forEach(({ x, y, z, key }) => {
    const chest = baseChest.clone();
    chest.position.set(x, y, z);
    chest.userData.projectKey = key;
    scene.add(chest);

    // Physics body (box approximation)
    const box = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    const body = new CANNON.Body({ mass: 1, shape: box });
    body.position.set(x, y + 1, z);
    world.addBody(body);
    chest.userData.body = body;
    chests.push(chest);
  });

  return { islands: [island], chests };
}