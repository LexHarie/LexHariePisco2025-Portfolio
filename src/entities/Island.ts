import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
import { Poolable } from '../utils/ObjectPool';

export class Island implements Poolable {
  // Three.js model and components
  private model: THREE.Group;
  private scene: THREE.Scene;
  private titleMesh: THREE.Mesh | null = null;
  
  // Physics
  private world: CANNON.World;
  private body: CANNON.Body;
  
  // Position and state
  private _position: THREE.Vector3 = new THREE.Vector3();
  private active: boolean = false;
  private seed: number;
  
  // Floating animation
  private floatingTween!: TWEEN.Tween<{ y: number }>;
  private floatingParams = { y: 0 };
  
  // Content
  private contentSections: string[];
  private contentIndex: number = 0;
  
  constructor(model: THREE.Group, scene: THREE.Scene, world: CANNON.World, contentSections: string[]) {
    this.model = model;
    this.scene = scene;
    this.world = world;
    this.contentSections = contentSections;
    this.seed = Math.random() * 1000;
    
    // Scale the island model
    const scale = 40 + Math.random() * 20; // Random scale between 40-60
    this.model.scale.set(scale, scale, scale);
    
    // Set up physics body
    const shapeRadius = scale * 0.4;
    const shape = new CANNON.Cylinder(shapeRadius, shapeRadius, 30, 8);
    this.body = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(0, 0, 0),
      shape,
      material: new CANNON.Material({
        friction: 0.5,
        restitution: 0.3
      })
    });
    
    // Set proper orientation for the cylinder
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    this.body.quaternion.copy(quat);
    
    // Set up the floating animation
    this.setupFloatingAnimation();
    
    // Create title mesh
    this.createTitleMesh();
  }
  
  private setupFloatingAnimation(): void {
    // Create the floating animation with a random phase offset based on seed
    this.floatingTween = new TWEEN.Tween(this.floatingParams)
      .to({ y: 1 }, 3000 + Math.random() * 1000)
      .repeat(Infinity)
      .yoyo(true)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .delay(this.seed % 1000)
      .start();
  }
  
  private createTitleMesh(): void {
    // Create a text geometry for the island title
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    
    // Clear the canvas
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    context.font = 'bold 40px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(this.contentSections[this.contentIndex], canvas.width / 2, canvas.height / 2);
    
    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create a billboard mesh
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const geometry = new THREE.PlaneGeometry(20, 10);
    this.titleMesh = new THREE.Mesh(geometry, material);
    this.titleMesh.position.y = 30;
    
    // Add to the model
    this.model.add(this.titleMesh);
  }
  
  public update(_deltaTime: number): void {
    if (!this.active) return;
    
    // Apply floating effect
    this.model.position.y = this.position.y + this.floatingParams.y * 0.5;
    
    // Update title mesh to face camera
    if (this.titleMesh) {
      // Find camera
      const camera = this.scene.getObjectByProperty('type', 'PerspectiveCamera') as THREE.PerspectiveCamera;
      if (camera) {
        // Make the title mesh face the camera (billboard effect)
        this.titleMesh.lookAt(camera.position);
      }
    }
  }
  
  public reset(): void {
    // Generate a new seed
    this.seed = Math.random() * 1000;
    
    // Reset the floating animation
    this.setupFloatingAnimation();
    
    // Random rotation
    this.model.rotation.y = Math.random() * Math.PI * 2;
  }
  
  public activate(): void {
    if (this.active) return;
    
    this.active = true;
    this.scene.add(this.model);
    this.world.addBody(this.body);
    
    // Start the floating animation
    this.floatingTween.start();
  }
  
  public deactivate(): void {
    if (!this.active) return;
    
    this.active = false;
    this.scene.remove(this.model);
    this.world.removeBody(this.body);
    
    // Stop the floating animation
    this.floatingTween.stop();
  }
  
  public isActive(): boolean {
    return this.active;
  }
  
  public setContentIndex(index: number): void {
    this.contentIndex = Math.min(index, this.contentSections.length - 1);
    
    // Update title mesh texture
    if (this.titleMesh) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const context = canvas.getContext('2d')!;
      
      // Clear the canvas
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add text
      context.font = 'bold 40px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#ffffff';
      context.fillText(this.contentSections[this.contentIndex], canvas.width / 2, canvas.height / 2);
      
      // Update texture
      const texture = new THREE.CanvasTexture(canvas);
      (this.titleMesh.material as THREE.MeshBasicMaterial).map = texture;
      (this.titleMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }
  
  public set position(pos: THREE.Vector3) {
    this._position.copy(pos);
    this.model.position.copy(pos);
    this.body.position.set(pos.x, pos.y, pos.z);
  }
  
  public get position(): THREE.Vector3 {
    return this._position;
  }
  
  public interact(): void {
    // Create overlay panel
    const panel = document.createElement('div');
    panel.className = 'overlay-panel overlay-active';
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
      panel.remove();
      
      // Remove background blur
      const renderer = document.querySelector('canvas');
      if (renderer) {
        renderer.style.filter = '';
      }
    });
    
    // Fetch and render content
    fetch(`/content/${this.contentSections[this.contentIndex].toLowerCase()}.md`)
      .then(response => response.text())
      .then(markdown => {
        // Simple markdown parsing (for a real app, use a proper MD library)
        const html = this.parseMarkdown(markdown);
        panel.innerHTML += html;
        panel.appendChild(closeButton);
      })
      .catch(error => {
        panel.innerHTML = `<h1>Error loading content</h1><p>${error.message}</p>`;
        panel.appendChild(closeButton);
      });
    
    // Add to UI
    document.getElementById('ui-overlay')?.appendChild(panel);
    
    // Add blur effect to background
    const renderer = document.querySelector('canvas');
    if (renderer) {
      renderer.style.filter = 'blur(5px)';
    }
  }
  
  private parseMarkdown(markdown: string): string {
    // Very basic markdown parsing
    let html = markdown
      // Headers
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^\s*?\- (.*$)/gm, '<li>$1</li>')
      // Paragraphs
      .replace(/^([^<].*?)$/gm, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '');
    
    // Wrap lists with <ul>
    let inList = false;
    const lines = html.split('\n');
    html = '';
    
    for (const line of lines) {
      if (line.startsWith('<li>') && !inList) {
        html += '<ul>';
        inList = true;
      } else if (!line.startsWith('<li>') && inList) {
        html += '</ul>';
        inList = false;
      }
      
      html += line + '\n';
    }
    
    if (inList) {
      html += '</ul>';
    }
    
    return html;
  }
}