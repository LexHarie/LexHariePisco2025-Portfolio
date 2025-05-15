import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Color,
  Fog
} from 'three';

export function initScene() {
  const scene = new Scene();
  scene.background = new Color(0x87ceeb);
  scene.fog = new Fog(0x87ceeb, 10, 1000);

  const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.set(0, 5, 10);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1
  );
  document.body.appendChild(renderer.domElement);

  const hemiLight = new HemisphereLight(0xffffff, 0x444444, 1.0);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(-3, 10, -10);
  scene.add(dirLight);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(
      window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1
    );
  });

  return { scene, camera, renderer };
}