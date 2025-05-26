import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
import { loadModel } from './utils/LoadingManager';
import { PerlinNoise } from './utils/PerlinNoise';
import { Ship } from './entities/Ship';
import { Island } from './entities/Island';
import { ShipControls } from './controls/ShipControls';

/**
 * Main World class that manages the 3D environment, physics, and game entities
 */
export default class World {
  // Three.js components
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  
  // Cannon.js physics
  private world: CANNON.World;
  private timeStep: number = 1/60;
  
  // Game entities
  private ship: Ship | null = null;
  private shipControls: ShipControls | null = null;
  private islands: Island[] = [];
  private nearestIsland: Island | null = null;
  private interactionDistance: number = 30; // Distance at which interaction is possible (reduced for smaller islands)
  
  // Environment
  private ocean: THREE.Mesh | null = null;
  private skybox: THREE.Mesh | null = null;
  
  // World generation
  private worldSeed: number;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  
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
    
    // Initialize camera with orthographic projection for isometric view
    const aspect = window.innerWidth / window.innerHeight;
    const d = 50;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      0.1,
      3000
    );
    this.camera.position.set(100, 100, 100);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    
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
    
    // Create experience islands
    await this.createExperienceIslands();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Create UI elements
    this.createUI();
    
    // Debug helpers
    if (this.debug) {
      this.setupDebugHelpers();
    }
    
    // Load CSS for pirate scroll
    this.loadScrollStyles();
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
    const oceanGeometry = new THREE.PlaneGeometry(2000, 2000, 32, 32);
    
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
  
  /**
   * Creates experience islands and places them in the world
   */
  private async createExperienceIslands(): Promise<void> {
    // Load island model
    const islandModel = await loadModel('/models/pirate_island.glb');
    
    // Create TechCorp Island (first job)
    const techCorpIsland = new Island(
      islandModel.clone(),
      this.scene,
      this.world,
      'experience',
      'Senior Frontend Developer',
    );
    
    // Position TechCorp Island to the east
    techCorpIsland.position = new THREE.Vector3(200, 0, 50);
    this.islands.push(techCorpIsland);
    
    // Create Creative Digital Agency Island (second job)
    const creativeDigitalIsland = new Island(
      islandModel.clone(),
      this.scene,
      this.world,
      'experience',
      'Web Developer',
    );
    
    // Position Creative Digital Agency Island to the west
    creativeDigitalIsland.position = new THREE.Vector3(-250, 0, -150);
    this.islands.push(creativeDigitalIsland);
  }
  
  private setupEventListeners(): void {
    // Add escape key listener for closing overlays
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const overlays = document.querySelectorAll('.overlay-panel, .project-card, .pirate-scroll-overlay');
        overlays.forEach(overlay => {
          // Find and click the close button if it exists
          const closeButton = overlay.querySelector('.close-button, .pirate-scroll-close');
          if (closeButton instanceof HTMLElement) {
            closeButton.click();
          } else {
            (overlay as HTMLElement).style.display = 'none';
          }
          
          // Resume physics and controls
          if (this.shipControls) {
            this.shipControls.enabled = true;
          }
        });
        
        // Remove background blur
        this.renderer.domElement.style.filter = '';
      }
      
      // Add E key for interaction
      if (event.key === 'e' || event.key === 'E') {
        this.handleInteraction();
      }
    });
  }
  
  private createUI(): void {
    // Create interaction prompt
    const prompt = document.createElement('div');
    prompt.className = 'interaction-prompt';
    prompt.textContent = 'Press E to view';
    document.body.appendChild(prompt);
    
    // Create UI overlay container if it doesn't exist
    if (!document.getElementById('ui-overlay')) {
      const uiOverlay = document.createElement('div');
      uiOverlay.id = 'ui-overlay';
      document.body.appendChild(uiOverlay);
    }
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
      
      // Find nearest island for interaction
      this.findNearestIsland();
    }
    
    // Update islands
    for (const island of this.islands) {
      island.update(deltaTime);
    }
    
    // Update UI
    this.updateUI();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Finds the nearest island to the ship for interaction
   */
  private findNearestIsland(): void {
    if (!this.ship) return;
    
    let nearestIsland: Island | null = null;
    let minDistance = Infinity;
    
    for (const island of this.islands) {
      const distance = this.ship.position.distanceTo(island.position);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIsland = island;
      }
    }
    
    this.nearestIsland = nearestIsland;
  }
  
  /**
   * Updates the UI elements
   */
  private updateUI(): void {
    // Update interaction prompt
    const promptEl = document.querySelector('.interaction-prompt');
    if (promptEl && this.nearestIsland) {
      const distance = this.ship?.position.distanceTo(this.nearestIsland.position) || Infinity;
      
      if (distance < this.interactionDistance) {
        // Show interaction prompt
        promptEl.classList.add('visible');
        (promptEl as HTMLElement).textContent = `Press E to view ${this.nearestIsland.getCompany()}`;
      } else {
        // Hide interaction prompt
        promptEl.classList.remove('visible');
      }
    } else if (promptEl) {
      // No nearby island, hide prompt
      promptEl.classList.remove('visible');
    }
  }
  
  /**
   * Handles interaction with the nearest island
   */
  private handleInteraction(): void {
    if (!this.nearestIsland || !this.ship) return;
    
    const distance = this.ship.position.distanceTo(this.nearestIsland.position);
    
    if (distance < this.interactionDistance) {
      // We're in range, trigger the interaction
      this.nearestIsland.interact();
      
      // Disable ship controls during interaction
      if (this.shipControls) {
        this.shipControls.enabled = false;
      }
    }
  }
  
  /**
   * Loads the pirate scroll CSS styles
   */
  private loadScrollStyles(): void {
    // Add pirate scroll CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/pirate-scroll.css';
    document.head.appendChild(link);
  }
  
  public handleResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 50;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public getShip(): Ship | null {
    return this.ship;
  }
  
  public getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }
  
  public getScene(): THREE.Scene {
    return this.scene;
  }
  
  public getWorld(): CANNON.World {
    return this.world;
  }
}