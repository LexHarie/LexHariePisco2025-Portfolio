import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
import { loadModel } from './utils/LoadingManager';
import { PerlinNoise } from './utils/PerlinNoise';
import { Ship } from './entities/Ship';
import { ShipControls } from './controls/ShipControls';

export default class World {
  // Three.js components
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  
  // Cannon.js physics
  private world: CANNON.World;
  private timeStep: number = 1/60;
  
  // Game entities
  private ship: Ship | null = null;
  private shipControls: ShipControls | null = null;
  
  // Environment
  private ocean: THREE.Mesh | null = null;
  private skybox: THREE.Mesh | null = null;
  
  // World generation
  private worldSeed: number;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  
  // UI elements removed
  // Stats tracking is still needed for internal calculations
  private stats = {
    deltaTime: 0,
  };
  
  // Debug
  public debug: boolean = false; // Kept but not used
  
  constructor() {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1a3b5c, 0.0025);
    
    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      3000
    );
    this.camera.position.set(0, 15, -30);
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x1a3b5c);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    
    // Initialize physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    
    // Initialize world generation
    this.worldSeed = Math.random() * 1000;
    new PerlinNoise(this.worldSeed); // Create but don't store reference since it's not used
    
    // Initialize clock
    this.clock = new THREE.Clock();
  }
  
  public async init(): Promise<void> {
    // Set up lighting
    this.setupLighting();
    
    // Create ocean and skybox
    await this.createEnvironment();
    
    // Initialize ship
    await this.createShip();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Create UI elements
    this.createUI();
    
    // Debug helpers
    if (this.debug) {
      this.setupDebugHelpers();
    }
  }
  
  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x6688aa, 0.5);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffaa, 1.2);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 300;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    
    this.scene.add(directionalLight);
    
    // Hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 0.8);
    this.scene.add(hemisphereLight);
  }
  
  private async createEnvironment(): Promise<void> {
    // Ocean
    const oceanGeometry = new THREE.PlaneGeometry(10000, 10000, 32, 32);
    
    // Use the existing texture from threejs.org
    const oceanTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/water/Water_1_M_Normal.jpg');
    oceanTexture.wrapS = THREE.RepeatWrapping;
    oceanTexture.wrapT = THREE.RepeatWrapping;
    oceanTexture.repeat.set(50, 50);
    
    const oceanMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066aa,
      normalMap: oceanTexture,
      normalScale: new THREE.Vector2(0.5, 0.5),
      metalness: 0.2,
      roughness: 0.7,
    });
    
    this.ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.receiveShadow = true;
    this.scene.add(this.ocean);
    
    // Enhance the skybox
    const skyboxGeometry = new THREE.SphereGeometry(3000, 64, 64);
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ddff, // Slightly brighter blue
      side: THREE.BackSide,
      fog: false,
    });
    
    this.skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    this.scene.add(this.skybox);
  }
  
  private async createShip(): Promise<void> {
    const shipModel = await loadModel('/models/pirate_ship.glb');
    this.ship = new Ship(shipModel, this.scene, this.world);
    
    // Ship's initial position is now handled in the Ship constructor
    
    this.shipControls = new ShipControls(this.ship, this.camera);
    
    // Set up camera to follow ship
    this.shipControls.init();
    
    // Add debug console message to help the user
    console.log('Ship controls: W/S to move forward/backward, A/D to turn, SHIFT to boost');
  }
  
  // Island and chest pools removed
  
  private setupEventListeners(): void {
    // Add escape key listener for closing overlays
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const overlays = document.querySelectorAll('.overlay-panel, .project-card');
        overlays.forEach(overlay => {
          (overlay as HTMLElement).style.display = 'none';
          
          // Resume physics and controls
          if (this.shipControls) {
            this.shipControls.enabled = true;
          }
        });
        
        // Remove background blur
        this.renderer.domElement.style.filter = '';
      }
    });
  }
  
  private createUI(): void {
    // Empty UI - debug elements removed
    // We can add cleaner UI elements later as needed
  }
  
  private setupDebugHelpers(): void {
    // Debug helpers removed
  }
  
  public animate(): void {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    this.stats.deltaTime = deltaTime;
    
    // Update TWEEN
    TWEEN.update();
    
    // Update physics
    this.world.step(this.timeStep);
    
    // Update ship and controls
    if (this.ship && this.shipControls) {
      this.ship.update(deltaTime);
      this.shipControls.update(deltaTime);
      
      // Update player position for world generation
      this.playerPosition.copy(this.ship.position);
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  // Entity pooling removed
  
  private updateUI(): void {
    // UI updates removed - no debug info displayed
  }
  
  // This private method is now unused and removed to fix TypeScript warning
  
  public handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public getShip(): Ship | null {
    return this.ship;
  }
  
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  
  public getScene(): THREE.Scene {
    return this.scene;
  }
  
  public getWorld(): CANNON.World {
    return this.world;
  }
}