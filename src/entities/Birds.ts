import * as THREE from 'three';

/**
 * Simple bird-like particles simulation in a defined area
 */
export class Birds {
  public points: THREE.Points;
  private velocities: THREE.Vector3[] = [];
  private areaCenter: THREE.Vector3;
  private areaRadius: number;
  private count: number;

  constructor(
    scene: THREE.Scene,
    center: THREE.Vector3,
    count: number = 200,
    radius: number = 50
  ) {
    this.areaCenter = center.clone();
    this.areaRadius = radius;
    this.count = count;

    // Initialize positions and velocities
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = center.x + (Math.random() - 0.5) * radius * 2;
      const y = center.y + Math.random() * radius * 0.5 + 5;
      const z = center.z + (Math.random() - 0.5) * radius * 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      // Random small velocity
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.2 - 0.1,
        Math.random() - 0.5
      ).normalize();
      this.velocities.push(dir);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });
    this.points = new THREE.Points(geometry, material);
    scene.add(this.points);
  }

  /**
   * Update bird positions each frame
   */
  public update(deltaTime: number): void {
    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      // Update position by velocity
      let x = posAttr.getX(i) + this.velocities[i].x * deltaTime * 20;
      let y = posAttr.getY(i) + this.velocities[i].y * deltaTime * 20;
      let z = posAttr.getZ(i) + this.velocities[i].z * deltaTime * 20;
      // Wrap around boundaries
      if (x < this.areaCenter.x - this.areaRadius) x = this.areaCenter.x + this.areaRadius;
      if (x > this.areaCenter.x + this.areaRadius) x = this.areaCenter.x - this.areaRadius;
      if (z < this.areaCenter.z - this.areaRadius) z = this.areaCenter.z + this.areaRadius;
      if (z > this.areaCenter.z + this.areaRadius) z = this.areaCenter.z - this.areaRadius;
      // Slight vertical oscillation
      y = this.areaCenter.y + Math.sin((Date.now() + i * 100) * 0.002) * 5 + 10;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  }
}