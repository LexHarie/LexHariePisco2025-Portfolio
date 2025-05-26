import * as THREE from 'three';
// import * as TWEEN from '@tweenjs/tween.js'; // Not used
import { Ship } from '../entities/Ship';
import { Island } from '../entities/Island';
import { Chest } from '../entities/Chest';

export class ShipControls {
  // References
  private ship: Ship;
  private camera: THREE.OrthographicCamera;
  
  // Camera settings
  private cameraPivotPoint = new THREE.Vector3();
  // Initial zoom (distance from ship), and zoom limits
  private cameraDistance = 800;
  private minCameraDistance = 200;
  private maxCameraDistance = 2000;
  private cameraSmoothingFactor = 0.1;
  private readonly isoPitch = THREE.MathUtils.degToRad(35);
  private readonly isoYaw = THREE.MathUtils.degToRad(45);
  
  
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
  
  constructor(ship: Ship, camera: THREE.OrthographicCamera) {
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
    
    // Zoom disabled to prevent fog/visibility issues on scroll
    // document.addEventListener('wheel', (event) => this.handleMouseWheel(event));
    
    // Disable context menu on right click
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    
    // Touch zoom not supported yet
    
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
  
  // Mouse drag is unused in isometric mode
  
  private handleMouseWheel(event: WheelEvent): void {
    if (!this.enabled) return;
    
    const zoomSpeed = 0.1;
    this.cameraDistance += event.deltaY * zoomSpeed;
    
    // Clamp zoom distance
    this.cameraDistance = Math.max(this.minCameraDistance, Math.min(this.maxCameraDistance, this.cameraDistance));
  }
  
  // Touch handlers unused in isometric mode
  
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
    
    // Calculate camera position using fixed isometric angles
    const offsetX = Math.cos(this.isoPitch) * Math.sin(this.isoYaw) * this.cameraDistance;
    const offsetZ = Math.cos(this.isoPitch) * Math.cos(this.isoYaw) * this.cameraDistance;
    const offsetY = Math.sin(this.isoPitch) * this.cameraDistance;
    
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