import * as THREE from 'three';
// import * as TWEEN from '@tweenjs/tween.js'; // Not used
import { Ship } from '../entities/Ship';
import { Island } from '../entities/Island';
import { Chest } from '../entities/Chest';

export class ShipControls {
  // References
  private ship: Ship;
  private camera: THREE.PerspectiveCamera;
  
  // Camera settings
  private cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
  private cameraPivotPoint = new THREE.Vector3();
  private cameraDistance = 30;
  private minCameraDistance = 10;
  private maxCameraDistance = 50;
  private cameraSmoothingFactor = 0.1;
  
  // Mouse controls
  private mouseDownPosition = new THREE.Vector2();
  private isMouseDown = false;
  private mouseSensitivity = 0.003;
  
  // Key states
  private keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    e: false
  };
  
  // Control state
  public enabled = true;
  
  constructor(ship: Ship, camera: THREE.PerspectiveCamera) {
    this.ship = ship;
    this.camera = camera;
  }
  
  public init(): void {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', (event) => this.handleKeyDown(event));
    document.addEventListener('keyup', (event) => this.handleKeyUp(event));
    
    // Mouse events
    document.addEventListener('mousedown', (event) => this.handleMouseDown(event));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    document.addEventListener('mousemove', (event) => this.handleMouseMove(event));
    document.addEventListener('wheel', (event) => this.handleMouseWheel(event));
    
    // Disable context menu on right click
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    
    // Touch events for mobile support
    document.addEventListener('touchstart', (event) => this.handleTouchStart(event));
    document.addEventListener('touchend', () => this.handleTouchEnd());
    document.addEventListener('touchmove', (event) => this.handleTouchMove(event));
    
    // Add interaction handler for keyboard
    document.addEventListener('keydown', (event) => {
      if (event.key === 'e' && this.enabled) {
        this.handleInteraction();
      }
    });
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;
    
    switch (event.key.toLowerCase()) {
      case 'w':
        this.keys.w = true;
        this.ship.setMovementDirection('forward', true);
        break;
      case 'a':
        this.keys.a = true;
        this.ship.setMovementDirection('left', true);
        break;
      case 's':
        this.keys.s = true;
        this.ship.setMovementDirection('backward', true);
        break;
      case 'd':
        this.keys.d = true;
        this.ship.setMovementDirection('right', true);
        break;
      case 'shift':
        this.keys.shift = true;
        this.ship.setBoost(true);
        break;
    }
  }
  
  private handleKeyUp(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'w':
        this.keys.w = false;
        this.ship.setMovementDirection('forward', false);
        break;
      case 'a':
        this.keys.a = false;
        this.ship.setMovementDirection('left', false);
        break;
      case 's':
        this.keys.s = false;
        this.ship.setMovementDirection('backward', false);
        break;
      case 'd':
        this.keys.d = false;
        this.ship.setMovementDirection('right', false);
        break;
      case 'shift':
        this.keys.shift = false;
        this.ship.setBoost(false);
        break;
    }
  }
  
  private handleMouseDown(event: MouseEvent): void {
    if (!this.enabled) return;
    
    this.isMouseDown = true;
    this.mouseDownPosition.set(event.clientX, event.clientY);
  }
  
  private handleMouseUp(): void {
    this.isMouseDown = false;
  }
  
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isMouseDown || !this.enabled) return;
    
    const deltaX = event.clientX - this.mouseDownPosition.x;
    const deltaY = event.clientY - this.mouseDownPosition.y;
    
    this.mouseDownPosition.set(event.clientX, event.clientY);
    
    // Update camera rotation
    this.cameraRotation.y -= deltaX * this.mouseSensitivity;
    this.cameraRotation.x -= deltaY * this.mouseSensitivity;
    
    // Clamp vertical rotation to prevent flipping
    this.cameraRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraRotation.x));
  }
  
  private handleMouseWheel(event: WheelEvent): void {
    if (!this.enabled) return;
    
    const zoomSpeed = 0.1;
    this.cameraDistance += event.deltaY * zoomSpeed;
    
    // Clamp zoom distance
    this.cameraDistance = Math.max(this.minCameraDistance, Math.min(this.maxCameraDistance, this.cameraDistance));
  }
  
  private handleTouchStart(event: TouchEvent): void {
    if (!this.enabled || event.touches.length === 0) return;
    
    this.isMouseDown = true;
    this.mouseDownPosition.set(event.touches[0].clientX, event.touches[0].clientY);
  }
  
  private handleTouchEnd(): void {
    this.isMouseDown = false;
  }
  
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isMouseDown || !this.enabled || event.touches.length === 0) return;
    
    const deltaX = event.touches[0].clientX - this.mouseDownPosition.x;
    const deltaY = event.touches[0].clientY - this.mouseDownPosition.y;
    
    this.mouseDownPosition.set(event.touches[0].clientX, event.touches[0].clientY);
    
    // Update camera rotation
    this.cameraRotation.y -= deltaX * this.mouseSensitivity;
    this.cameraRotation.x -= deltaY * this.mouseSensitivity;
    
    // Clamp vertical rotation to prevent flipping
    this.cameraRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraRotation.x));
  }
  
  private handleInteraction(): void {
    // Find nearest interactable object (island or chest)
    const scene = this.camera.parent;
    if (!scene) return;
    
    let nearestDistance = Infinity;
    let nearestInteractable: (Island | Chest) | null = null;
    
    // Check for islands
    scene.traverse((object) => {
      if (object.userData.entity instanceof Island) {
        const island = object.userData.entity as Island;
        const distance = island.position.distanceTo(this.ship.position);
        
        if (distance < 15 && distance < nearestDistance) {
          nearestDistance = distance;
          nearestInteractable = island;
        }
      }
    });
    
    // Check for chests
    scene.traverse((object) => {
      if (object.userData.entity instanceof Chest) {
        const chest = object.userData.entity as Chest;
        const distance = chest.position.distanceTo(this.ship.position);
        
        if (distance < 10 && distance < nearestDistance) {
          nearestDistance = distance;
          nearestInteractable = chest;
        }
      }
    });
    
    // Interact with nearest object
    if (nearestInteractable) {
      // Call the interact method on the object
      if (typeof (nearestInteractable as any).interact === 'function') {
        (nearestInteractable as any).interact();
      }
      
      // Disable controls while interacting
      this.enabled = false;
    }
  }
  
  public update(_deltaTime: number): void {
    if (!this.ship) return;
    
    // Update camera pivot point to ship position
    this.cameraPivotPoint.copy(this.ship.position);
    
    // Calculate camera position based on rotation and distance
    const offsetX = Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x) * this.cameraDistance;
    const offsetZ = Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x) * this.cameraDistance;
    const offsetY = Math.sin(this.cameraRotation.x) * this.cameraDistance;
    
    const targetCameraPosition = new THREE.Vector3(
      this.cameraPivotPoint.x + offsetX,
      this.cameraPivotPoint.y + offsetY + 5, // Add a small vertical offset
      this.cameraPivotPoint.z + offsetZ
    );
    
    // Smooth camera movement
    this.camera.position.lerp(targetCameraPosition, this.cameraSmoothingFactor);
    
    // Make camera look at ship with slight forward offset
    const targetLookAt = new THREE.Vector3(
      this.cameraPivotPoint.x,
      this.cameraPivotPoint.y + 5,
      this.cameraPivotPoint.z
    );
    
    this.camera.lookAt(targetLookAt);
  }
}