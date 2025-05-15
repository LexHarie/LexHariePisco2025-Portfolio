import { Vector3 } from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export function initControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);
  const velocity = new Vector3();
  const direction = new Vector3();
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;

  domElement.addEventListener('click', () => controls.lock());

  const onKeyDown = (event) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;
    }
  };

  const onKeyUp = (event) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  controls.update = (delta) => {
    if (controls.isLocked) {
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;

      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();

      if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

      controls.moveRight(-velocity.x * delta);
      controls.moveForward(-velocity.z * delta);
    }
  };

  return controls;
}