import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
import { loadModel } from './utils/LoadingManager';
import { PerlinNoise } from './utils/PerlinNoise';
import { ObjectPool } from './utils/ObjectPool';
import { Ship } from './entities/Ship';
import { Island } from './entities/Island';
import { Chest } from './entities/Chest';
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
  private islandPool: ObjectPool<Island> | null = null;
  private chestPool: ObjectPool<Chest> | null = null;
  
  // Environment
  private ocean: THREE.Mesh | null = null;
  private skybox: THREE.Mesh | null = null;
  
  // World generation
  private worldSeed: number;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  private activeRadius: number = 2500;
  private generationRadius: number = 2000;
  
  // UI elements
  private stats = {
    fps: 0,
    deltaTime: 0,
    speed: 0,
    stamina: 1.0
  };
  
  // Debug
  public debug: boolean = false;
  
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
    
    // Initialize island pool
    await this.createIslandPool();
    
    // Initialize chest pool
    await this.createChestPool();
    
    // Place initial entities
    this.generateInitialEntities();
    
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
    
    // Create a procedural ocean texture instead of loading one
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
    
    // Create simple skybox
    const skyboxGeometry = new THREE.SphereGeometry(2500, 32, 32);
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      color: 0x88aadd,
      side: THREE.BackSide,
      fog: false,
    });
    
    this.skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    this.scene.add(this.skybox);
  }
  
  private async createShip(): Promise<void> {
    const shipModel = await loadModel('/models/pirate_ship.glb');
    this.ship = new Ship(shipModel, this.scene, this.world);
    this.shipControls = new ShipControls(this.ship, this.camera);
    
    // Set up camera to follow ship
    this.shipControls.init();
  }
  
  private async createIslandPool(): Promise<void> {
    const islandModel = await loadModel('/models/pirate_island.glb');
    
    // Create island factory function
    const createIsland = () => {
      return new Island(
        islandModel.clone(),
        this.scene,
        this.world,
        [
          'About',
          'Skills',
          'Experience',
          'Education',
          'Contact'
        ]
      );
    };
    
    // Initialize the pool with 5 islands (one for each section)
    this.islandPool = new ObjectPool<Island>(createIsland, 5, 5);
  }
  
  private async createChestPool(): Promise<void> {
    const chestModel = await loadModel('/models/greedy_octopuss_treasure_chest.glb');
    
    // Fetch project data
    const response = await fetch('/content/projects.json');
    const projectData = await response.json();
    
    // Create chest factory function
    const createChest = () => {
      return new Chest(
        chestModel.clone(),
        this.scene,
        this.world,
        projectData
      );
    };
    
    // Initialize the pool with 10 initial chests, max 30
    this.chestPool = new ObjectPool<Chest>(createChest, 10, 30);
  }
  
  private generateInitialEntities(): void {
    if (!this.islandPool || !this.chestPool) return;
    
    // Place islands in a circular pattern around the origin
    const islandCount = 5;
    const radius = 300;
    
    for (let i = 0; i < islandCount; i++) {
      const angle = (i / islandCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const island = this.islandPool.get();
      island.position.set(x, 0, z);
      island.setContentIndex(i);
    }
    
    // Place initial chests
    const chestCount = 10;
    const innerRadius = 150;
    const outerRadius = 500;
    
    for (let i = 0; i < chestCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = innerRadius + Math.random() * (outerRadius - innerRadius);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      const chest = this.chestPool.get();
      chest.position.set(x, 5, z);
      chest.setProjectIndex(i % 6); // Cycle through the 6 projects
    }
  }
  
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
    // Create compass
    const compass = document.createElement('div');
    compass.className = 'hud compass';
    compass.textContent = 'N';
    document.getElementById('ui-overlay')?.appendChild(compass);
    
    // Create stats display
    const stats = document.createElement('div');
    stats.className = 'hud stats';
    document.getElementById('ui-overlay')?.appendChild(stats);
    
    // Create interaction prompt
    const prompt = document.createElement('div');
    prompt.className = 'interaction-prompt';
    prompt.textContent = 'Press E to interact';
    document.getElementById('ui-overlay')?.appendChild(prompt);
  }
  
  private setupDebugHelpers(): void {
    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(1000, 100);
    this.scene.add(gridHelper);
  }
  
  public animate(): void {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    this.stats.deltaTime = deltaTime;
    this.stats.fps = 1 / deltaTime;
    
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
      this.stats.speed = this.ship.getCurrentSpeed();
      this.stats.stamina = this.ship.getStamina();
    }
    
    // Update entities
    if (this.islandPool) {
      this.islandPool.update(deltaTime);
    }
    
    if (this.chestPool) {
      this.chestPool.update(deltaTime);
    }
    
    // Check for out-of-range entities and replace them
    this.manageEntityPooling();
    
    // Update UI
    this.updateUI();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  private manageEntityPooling(): void {
    if (!this.islandPool || !this.chestPool) return;
    
    // Check islands
    const islands = this.islandPool.getTotalCount();
    for (let i = 0; i < islands; i++) {
      const island = (this.islandPool as any).pool[i]; // Accessing private property for simplicity
      if (island.isActive()) {
        const distance = island.position.distanceTo(this.playerPosition);
        
        // If island is too far, recycle it
        if (distance > this.activeRadius) {
          island.deactivate();
          
          // Place a new island within generation radius
          const angle = Math.random() * Math.PI * 2;
          const newRadius = this.generationRadius * 0.7 + Math.random() * (this.generationRadius * 0.3);
          const x = this.playerPosition.x + Math.cos(angle) * newRadius;
          const z = this.playerPosition.z + Math.sin(angle) * newRadius;
          
          const newIsland = this.islandPool.get();
          newIsland.position.set(x, 0, z);
          newIsland.setContentIndex(Math.floor(Math.random() * 5));
        }
      }
    }
    
    // Check chests
    const chests = this.chestPool.getTotalCount();
    for (let i = 0; i < chests; i++) {
      const chest = (this.chestPool as any).pool[i]; // Accessing private property for simplicity
      if (chest.isActive()) {
        const distance = chest.position.distanceTo(this.playerPosition);
        
        // If chest is too far, recycle it
        if (distance > this.activeRadius) {
          chest.deactivate();
          
          // Place a new chest within generation radius
          const angle = Math.random() * Math.PI * 2;
          const newRadius = this.generationRadius * 0.5 + Math.random() * (this.generationRadius * 0.5);
          const x = this.playerPosition.x + Math.cos(angle) * newRadius;
          const z = this.playerPosition.z + Math.sin(angle) * newRadius;
          
          const newChest = this.chestPool.get();
          newChest.position.set(x, 5, z);
          newChest.setProjectIndex(Math.floor(Math.random() * 6));
        }
      }
    }
  }
  
  private updateUI(): void {
    // Update stats display
    const statsEl = document.querySelector('.stats');
    if (statsEl) {
      statsEl.textContent = `FPS: ${Math.round(this.stats.fps)} | Speed: ${Math.round(this.stats.speed * 10) / 10} | Stamina: ${Math.round(this.stats.stamina * 100)}%`;
    }
    
    // Update compass
    if (this.ship) {
      const compassEl = document.querySelector('.compass');
      if (compassEl) {
        const direction = Math.round((this.ship.getRotation() * 180 / Math.PI) % 360);
        let compassPoint = 'N';
        
        if (direction >= 45 && direction < 135) compassPoint = 'E';
        else if (direction >= 135 && direction < 225) compassPoint = 'S';
        else if (direction >= 225 && direction < 315) compassPoint = 'W';
        
        compassEl.textContent = compassPoint;
      }
    }
    
    // Update interaction prompt
    const nearestInteractable = this.findNearestInteractable();
    const promptEl = document.querySelector('.interaction-prompt');
    
    if (promptEl && nearestInteractable) {
      (promptEl as HTMLElement).style.opacity = '1';
      (promptEl as HTMLElement).textContent = `Press E to ${nearestInteractable.type === 'island' ? 'view' : 'open'}`;
    } else if (promptEl) {
      (promptEl as HTMLElement).style.opacity = '0';
    }
  }
  
  private findNearestInteractable(): { distance: number, type: 'island' | 'chest' } | null {
    if (!this.ship || !this.islandPool || !this.chestPool) return null;
    
    let nearestIsland = { distance: Infinity, type: 'island' as const };
    let nearestChest = { distance: Infinity, type: 'chest' as const };
    
    // Check islands
    const islands = this.islandPool.getTotalCount();
    for (let i = 0; i < islands; i++) {
      const island = (this.islandPool as any).pool[i];
      if (island.isActive()) {
        const distance = island.position.distanceTo(this.ship.position);
        if (distance < 15 && distance < nearestIsland.distance) {
          nearestIsland.distance = distance;
        }
      }
    }
    
    // Check chests
    const chests = this.chestPool.getTotalCount();
    for (let i = 0; i < chests; i++) {
      const chest = (this.chestPool as any).pool[i];
      if (chest.isActive()) {
        const distance = chest.position.distanceTo(this.ship.position);
        if (distance < 10 && distance < nearestChest.distance) {
          nearestChest.distance = distance;
        }
      }
    }
    
    // Return the nearest interactable
    if (nearestIsland.distance < nearestChest.distance) {
      return nearestIsland.distance < Infinity ? nearestIsland : null;
    } else {
      return nearestChest.distance < Infinity ? nearestChest : null;
    }
  }
  
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