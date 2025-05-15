import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Configure the DefaultLoadingManager for global loading state
const loadingManager = THREE.DefaultLoadingManager;
loadingManager.onStart = (url, _itemsLoaded, _itemsTotal) => {
  console.log(`Started loading: ${url}`);
};

loadingManager.onError = (url) => {
  console.error(`Error loading: ${url}`);
};

// Configure DRACO loader for compressed models
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
dracoLoader.setDecoderConfig({ type: 'js' });

// Configure GLTF loader
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

// Configure texture loader with NearestFilter as default
const textureLoader = new THREE.TextureLoader(loadingManager);
textureLoader.crossOrigin = 'anonymous';

// Helper function to load a texture with NearestFilter by default
export const loadTexture = (path: string): Promise<THREE.Texture> => {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      path,
      (texture) => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      (error) => reject(error)
    );
  });
};

// Helper function to load a GLTF model
export const loadModel = (path: string): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        
        // Apply NearestFilter to all textures in the model
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = child.material;
            if (material) {
              if (material.map) {
                material.map.minFilter = THREE.NearestFilter;
                material.map.magFilter = THREE.NearestFilter;
                material.map.needsUpdate = true;
              }
              if (material.normalMap) {
                material.normalMap.minFilter = THREE.NearestFilter;
                material.normalMap.magFilter = THREE.NearestFilter;
                material.normalMap.needsUpdate = true;
              }
            }
          }
        });
        
        resolve(model);
      },
      undefined,
      (error) => reject(error)
    );
  });
};

// Export loaders
export { textureLoader, gltfLoader, loadingManager };