import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
import { Poolable } from '../utils/ObjectPool';

interface ProjectData {
  id: string;
  name: string;
  year: number;
  description: string;
  techStack: string[];
  github: string;
  liveDemo: string;
  thumbnail: string;
}

export class Chest implements Poolable {
  // Three.js model and components
  private model: THREE.Group;
  private scene: THREE.Scene;
  private lidMesh: THREE.Object3D | null = null;
  
  // Physics
  private world: CANNON.World;
  private body: CANNON.Body;
  
  // Position and state
  private _position: THREE.Vector3 = new THREE.Vector3();
  private active: boolean = false;
  private opened: boolean = false;
  
  // Drifting
  private driftDirection: THREE.Vector3;
  private driftSpeed: number;
  private maxDriftSpeed: number = 2;
  
  // Particles
  private particles: THREE.Points | null = null;
  
  // Project data
  private projectData: ProjectData[];
  private currentProjectIndex: number = 0;
  
  constructor(model: THREE.Group, scene: THREE.Scene, world: CANNON.World, projectData: ProjectData[]) {
    this.model = model;
    this.scene = scene;
    this.world = world;
    this.projectData = projectData;
    
    // Scale the chest model
    this.model.scale.set(10, 10, 10);
    
    // Find the lid mesh for animation
    this.findLidMesh();
    
    // Set up physics body
    const shape = new CANNON.Box(new CANNON.Vec3(5, 3, 5));
    this.body = new CANNON.Body({
      mass: 10,
      position: new CANNON.Vec3(0, 0, 0),
      shape,
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.3
      })
    });
    
    // Configure physics
    this.body.linearDamping = 0.8;
    this.body.angularDamping = 0.9;
    
    // Initialize drifting
    this.driftDirection = new THREE.Vector3(
      Math.random() * 2 - 1,
      0,
      Math.random() * 2 - 1
    ).normalize();
    
    this.driftSpeed = Math.random() * this.maxDriftSpeed;
    
    // Create particle system
    this.createParticleSystem();
  }
  
  private findLidMesh(): void {
    // Find the lid mesh based on name (assuming the model has a part named "lid" or similar)
    this.model.traverse((child) => {
      if (child.name.toLowerCase().includes('lid') || 
          child.name.toLowerCase().includes('top') ||
          child.name.toLowerCase().includes('cover')) {
        this.lidMesh = child;
      }
    });
    
    // If no lid is found, just use the first mesh as a fallback
    if (!this.lidMesh) {
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh && !this.lidMesh) {
          this.lidMesh = child;
        }
      });
    }
  }
  
  private createParticleSystem(): void {
    // Create particles that will be shown when chest opens
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    // All particles start at origin (will be updated when chest opens)
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffcc00,
      size: 0.5,
      blending: THREE.AdditiveBlending,
      transparent: true,
      sizeAttenuation: true
    });
    
    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.particles.visible = false;
    this.model.add(this.particles);
  }
  
  public update(_deltaTime: number): void {
    if (!this.active) return;
    
    // Apply drifting force
    const driftForce = new CANNON.Vec3(
      this.driftDirection.x * this.driftSpeed,
      0,
      this.driftDirection.z * this.driftSpeed
    );
    
    this.body.applyForce(driftForce, this.body.position);
    
    // Apply water buoyancy (simplified)
    this.applyBuoyancy();
    
    // Update visual position from physics
    this.model.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    
    this.model.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    
    // Update particles if chest is open
    if (this.opened && this.particles) {
      const positions = (this.particles.geometry as THREE.BufferGeometry).getAttribute('position').array;
      
      for (let i = 0; i < positions.length / 3; i++) {
        // Update particle positions for floating effect
        positions[i * 3 + 1] += 0.05; // Move up
        
        // Random horizontal drift
        positions[i * 3] += (Math.random() - 0.5) * 0.1;
        positions[i * 3 + 2] += (Math.random() - 0.5) * 0.1;
        
        // Reset particles that moved too far
        if (positions[i * 3 + 1] > 10) {
          positions[i * 3] = this.model.position.x + (Math.random() - 0.5) * 2;
          positions[i * 3 + 1] = this.model.position.y;
          positions[i * 3 + 2] = this.model.position.z + (Math.random() - 0.5) * 2;
        }
      }
      
      (this.particles.geometry as THREE.BufferGeometry).getAttribute('position').needsUpdate = true;
    }
    
    // Update drift direction occasionally
    if (Math.random() < 0.01) {
      this.changeDriftDirection();
    }
  }
  
  private applyBuoyancy(): void {
    // Enhanced buoyancy: apply force proportional to chest's depth below water
    const waterLevel = 0;
    const chestHeight = 6; // Total height of the chest
    const submergedRatio = Math.max(0, Math.min(1, (waterLevel - (this.body.position.y - chestHeight/2)) / chestHeight));
    
    if (submergedRatio > 0) {
      // Apply upward force proportional to submerged volume (increased from 12 to 20)
      const buoyancyForce = new CANNON.Vec3(0, 20 * submergedRatio, 0);
      this.body.applyLocalForce(buoyancyForce, new CANNON.Vec3(0, 0, 0));
      
      // Apply water resistance as damping
      const dampingForce = new CANNON.Vec3(
        -this.body.velocity.x * 1.0 * submergedRatio,
        -this.body.velocity.y * 0.5 * submergedRatio, // Less vertical damping
        -this.body.velocity.z * 1.0 * submergedRatio
      );
      this.body.applyForce(dampingForce, this.body.position);
    }
  }
  
  private changeDriftDirection(): void {
    // Slightly adjust drift direction
    this.driftDirection.x += (Math.random() - 0.5) * 0.5;
    this.driftDirection.z += (Math.random() - 0.5) * 0.5;
    this.driftDirection.normalize();
    
    // Also adjust drift speed
    this.driftSpeed = Math.random() * this.maxDriftSpeed;
  }
  
  public reset(): void {
    this.opened = false;
    
    // Reset lid rotation if it exists
    if (this.lidMesh) {
      this.lidMesh.rotation.x = 0;
    }
    
    // Hide particles
    if (this.particles) {
      this.particles.visible = false;
    }
    
    // Reset physics
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    
    // Reset drift
    this.driftDirection = new THREE.Vector3(
      Math.random() * 2 - 1,
      0,
      Math.random() * 2 - 1
    ).normalize();
    
    this.driftSpeed = Math.random() * this.maxDriftSpeed;
  }
  
  public activate(): void {
    if (this.active) return;
    
    this.active = true;
    this.scene.add(this.model);
    this.world.addBody(this.body);
  }
  
  public deactivate(): void {
    if (!this.active) return;
    
    this.active = false;
    this.scene.remove(this.model);
    this.world.removeBody(this.body);
    
    // Make sure to close the chest when deactivating
    this.closeChest();
  }
  
  public isActive(): boolean {
    return this.active;
  }
  
  public set position(pos: THREE.Vector3) {
    this._position.copy(pos);
    this.model.position.copy(pos);
    this.body.position.set(pos.x, pos.y, pos.z);
    
    // Reset physics state when position is manually set
    // This prevents issues with accumulated velocity when recycling objects
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    
    // Apply a small random rotation
    const randomRotation = new CANNON.Quaternion();
    randomRotation.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      Math.random() * Math.PI * 2
    );
    this.body.quaternion.copy(randomRotation);
    this.model.quaternion.set(
      randomRotation.x,
      randomRotation.y,
      randomRotation.z,
      randomRotation.w
    );
  }
  
  public get position(): THREE.Vector3 {
    return this._position;
  }
  
  public setProjectIndex(index: number): void {
    this.currentProjectIndex = Math.min(index, this.projectData.length - 1);
  }
  
  public openChest(): void {
    if (this.opened) return;
    
    this.opened = true;
    
    // Animate lid opening
    if (this.lidMesh) {
      new TWEEN.Tween(this.lidMesh.rotation)
        .to({ x: -Math.PI / 2 }, 1000)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();
    }
    
    // Show particles
    if (this.particles) {
      this.particles.visible = true;
      
      // Initialize particle positions
      const positions = (this.particles.geometry as THREE.BufferGeometry).getAttribute('position').array;
      
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 1] = Math.random() * 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      }
      
      (this.particles.geometry as THREE.BufferGeometry).getAttribute('position').needsUpdate = true;
    }
    
    // Show project card
    this.showProjectCard();
  }
  
  public closeChest(): void {
    if (!this.opened) return;
    
    this.opened = false;
    
    // Animate lid closing
    if (this.lidMesh) {
      new TWEEN.Tween(this.lidMesh.rotation)
        .to({ x: 0 }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    }
    
    // Hide particles
    if (this.particles) {
      this.particles.visible = false;
    }
  }
  
  private showProjectCard(): void {
    const project = this.projectData[this.currentProjectIndex];
    
    // Create project card
    const card = document.createElement('div');
    card.className = 'project-card overlay-active';
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
      card.remove();
      this.closeChest();
      
      // Remove background blur
      const renderer = document.querySelector('canvas');
      if (renderer) {
        renderer.style.filter = '';
      }
    });
    
    // Create card content
    card.innerHTML = `
      <h2>${project.name}</h2>
      <p class="year">${project.year}</p>
      <p class="description">${project.description}</p>
      <div class="tech-stack">
        ${project.techStack.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
      </div>
      <div class="project-links">
        <a href="${project.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="${project.liveDemo}" target="_blank" rel="noopener noreferrer">Live Demo</a>
      </div>
    `;
    
    card.appendChild(closeButton);
    
    // Add to UI
    document.getElementById('ui-overlay')?.appendChild(card);
    
    // Add blur effect to background
    const renderer = document.querySelector('canvas');
    if (renderer) {
      renderer.style.filter = 'blur(5px)';
    }
  }
  
  public interact(): void {
    // Open the chest when interacted with
    this.openChest();
  }
}