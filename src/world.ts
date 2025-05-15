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
    
    // Update UI
    this.updateUI();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  // Entity pooling removed
  
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
    
    // Hide interaction prompt since we have no interactables
    const promptEl = document.querySelector('.interaction-prompt');
    if (promptEl) {
      (promptEl as HTMLElement).style.opacity = '0';
    }
  }
  
  private findNearestInteractable(): null {
    // No interactables in this simplified version
    return null;
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