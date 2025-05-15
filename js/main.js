import { Clock } from 'three';
import { initScene } from './scene.js';
import { initPhysics } from './physics.js';
import { initControls } from './controls.js';
import { initUI } from './ui.js';
import { loadAssets } from './assetsLoader.js';
import { initChestInteractions } from './chest.js';

async function init() {
  const clock = new Clock();
  const { scene, camera, renderer } = initScene();
  const world = initPhysics();
  const controls = initControls(camera, renderer.domElement);
  const ui = initUI();
  const { islands, chests } = await loadAssets(scene, world);
  initChestInteractions({ scene, camera, renderer, ui, chests, world });

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    world.step(1 / 60, delta, 3);
    controls.update(delta);
    renderer.render(scene, camera);
  }
  animate();
}

init();