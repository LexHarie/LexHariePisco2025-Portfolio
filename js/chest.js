import { Raycaster, Vector2 } from 'three';
import { Tween, Easing, update as updateTween } from '@tweenjs/tween.js';

// Set up animation loop for tweens
function animate() {
  requestAnimationFrame(animate);
  updateTween();
}
animate();

export function initChestInteractions({ scene, camera, renderer, ui, chests }) {
  const raycaster = new Raycaster();
  const mouse = new Vector2();

  renderer.domElement.addEventListener('click', onClick);

  function onClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(chests, true);
    if (hits.length > 0) {
      const hit = hits[0].object;
      const chest = chests.find(c => c.uuid === (hit.parent ? hit.parent.uuid : hit.uuid));
      if (chest) openChest(chest);
    }
  }

  function openChest(chest) {
    const lid = chest.getObjectByName('Lid') || chest.children.find(c => c.name.toLowerCase().includes('lid'));
    if (lid) {
      new Tween(lid.rotation)
        .to({ x: -Math.PI / 2 }, 500)
        .easing(Easing.Cubic.Out)
        .start();
    }
    const info = getProjectInfo(chest.userData.projectKey);
    ui.show(info);
  }

  function getProjectInfo(key) {
    const data = {
      project1: '<h3>Pirate Map App</h3><p>An interactive map application with treasure hunt mechanics.</p>',
      project2: '<h3>Pirate Deck Builder</h3><p>A card-based deck builder game set in a pirate universe.</p>'
    };
    return data[key] || '<p>Project details coming soon.</p>';
  }
}