import * as THREE from 'three';

// Create a simple scene to test if Three.js is working
export function createDebugScene() {
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a3b5c);
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
  );
  camera.position.z = 5;
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  document.body.appendChild(renderer.domElement);
  
  // Create a cube
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  
  // Add some light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    
    renderer.render(scene, camera);
  }
  
  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Start animation
  animate();
  
  // Add a text overlay to show it's working
  const debugInfo = document.createElement('div');
  debugInfo.style.position = 'absolute';
  debugInfo.style.top = '10px';
  debugInfo.style.left = '10px';
  debugInfo.style.color = 'white';
  debugInfo.style.fontFamily = 'monospace';
  debugInfo.style.fontSize = '16px';
  debugInfo.style.padding = '10px';
  debugInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  debugInfo.style.borderRadius = '5px';
  debugInfo.textContent = 'Debug scene is working! Three.js is properly initialized.';
  document.body.appendChild(debugInfo);
  
  console.log('Debug scene created successfully');
  
  return { scene, camera, renderer };
}