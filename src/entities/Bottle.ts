import * as THREE from 'three';

/**
 * Options for creating a floating bottle scroll
 */
export interface BottleOptions {
  link: string;               // URL to open when bottle is reached
  textureUrl: string;         // Path to project image texture
  position: THREE.Vector3;    // Initial position in world
}

/**
 * Bottle entity: a floating scroll-in-a-bottle showing a project image
 */
export class Bottle {
  public model: THREE.Group;
  public triggered: boolean = false; // Has the link been opened
  public link: string;

  private bobOffset: number = 0;
  private baseY: number;
  private driftDirection: THREE.Vector3;
  private driftSpeed: number;

  constructor(template: THREE.Group, scene: THREE.Scene, options: BottleOptions) {
    // Clone the template model
    this.model = template.clone();
    this.link = options.link;
    this.baseY = options.position.y;
    this.model.position.copy(options.position);
    scene.add(this.model);

    // Scale to appropriate size
    const scale = 10;
    this.model.scale.set(scale, scale, scale);

    // Tag for interaction if needed
    (this.model as any).userData.entity = this;

    // Initialize drift direction and speed
    this.driftDirection = new THREE.Vector3(
      Math.random() * 2 - 1,
      0,
      Math.random() * 2 - 1
    ).normalize();
    this.driftSpeed = Math.random() * 0.5 + 0.1;

    // Load and apply project texture onto scroll mesh
    const loader = new THREE.TextureLoader();
    loader.load(options.textureUrl, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.toLowerCase().includes('scroll')) {
          const mat = child.material as THREE.MeshBasicMaterial;
          mat.map = texture;
          mat.transparent = true;
          mat.needsUpdate = true;
        }
      });
    });
  }

  /**
   * Update position: bobbing and drifting
   */
  public update(deltaTime: number): void {
    // Bobbing up and down
    this.bobOffset += deltaTime;
    this.model.position.y = this.baseY + Math.sin(this.bobOffset) * 2;
    // Drift horizontally
    this.model.position.x += this.driftDirection.x * this.driftSpeed * deltaTime;
    this.model.position.z += this.driftDirection.z * this.driftSpeed * deltaTime;
  }

  /**
   * Get current world position of the bottle
   */
  public getPosition(): THREE.Vector3 {
    return this.model.position;
  }
}