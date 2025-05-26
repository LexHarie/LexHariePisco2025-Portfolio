import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
// @ts-ignore – three/examples has no type declarations by default


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
  
  // Environment (Water from three examples)
  private ocean: any | null = null; // Water instance (no TS types)
  private skybox: THREE.Mesh | null = null;

  // Audio
  private ambientSound: THREE.Audio | null = null;
  private ambientStarted = false;
  
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

    // Background audio
    this.setupBackgroundAudio();
    
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
    // ------------------------------
    // Gerstner-wave ocean
    // ------------------------------

    const oceanGeometry = new THREE.PlaneGeometry(20000, 20000, 512, 512);

    const oceanMaterial = new THREE.MeshStandardMaterial({
      color: 0x0e6aa8,
      roughness: 0.85,
      metalness: 0.2,
      transparent: true,
      opacity: 0.98,
    });

    // Attach Gerstner-wave deformation in onBeforeCompile hook
    oceanMaterial.onBeforeCompile = (shader: any) => {
      shader.uniforms.uTime = { value: 0 };

      shader.uniforms.uWaveDir = {
        value: [
          new THREE.Vector2(1.0, 0.0),
          new THREE.Vector2(0.8, 0.6),
          new THREE.Vector2(-0.6, 0.8),
          new THREE.Vector2(0.2, -1.0),
        ],
      } as any;

      shader.uniforms.uAmplitude = { value: [2.0, 1.4, 1.0, 0.6] } as any;
      shader.uniforms.uWavelength = { value: [12.0, 8.0, 6.0, 4.0] } as any;
      shader.uniforms.uSpeed = { value: [1.0, 0.9, 0.8, 0.7] } as any;
      shader.uniforms.uSteepness = { value: [0.6, 0.5, 0.45, 0.4] } as any;

      // GLSL injection point
      const gerstnerPars = /* glsl */ `
        #define GERSTNER_WAVES 4
        uniform float uTime;
        uniform vec2 uWaveDir[GERSTNER_WAVES];
        uniform float uAmplitude[GERSTNER_WAVES];
        uniform float uWavelength[GERSTNER_WAVES];
        uniform float uSteepness[GERSTNER_WAVES];
        uniform float uSpeed[GERSTNER_WAVES];

        const float G = 9.81;

        // Returns displaced position (x, y, z)
        vec3 gerstnerDisplace(vec3 position) {
          vec3 newPos = position;
          for (int i = 0; i < GERSTNER_WAVES; i++) {
            float k = 2.0 * PI / uWavelength[i];
            float c = sqrt(G / k);
            vec2 d = normalize(uWaveDir[i]);
            float f = k * dot(d, position.xz) + uSpeed[i] * k * uTime;
            float A = uAmplitude[i];
            float S = sin(f);
            float C = cos(f);
            float Qi = uSteepness[i] / (k * A * float(GERSTNER_WAVES));

            newPos.x += Qi * A * d.x * C;
            newPos.z += Qi * A * d.y * C;
            newPos.y += A * S;
          }
          return newPos;
        }
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${gerstnerPars}`,
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n
        vec3 transformedPos = gerstnerDisplace(transformed);\n
        // use displaced position\n        transformed = transformedPos;`,
      );

      // Store reference for animation loop
      oceanMaterial.userData.shader = shader;
    };

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

  // -----------------------------
  // Audio
  // -----------------------------
  private setupBackgroundAudio(): void {
    const listener = new THREE.AudioListener();
    this.camera.add(listener);

    const sound = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    // Try formats in order until one decodes successfully
    const sources = [
      '/audio/620446__klankbeeld__river-shipping-nl-1232pm-210921_0316.mp3',
      '/audio/620446__klankbeeld__river-shipping-nl-1232pm-210921_0316.ogg',
      '/audio/620446__klankbeeld__river-shipping-nl-1232pm-210921_0316.flac',
    ];

    const tryLoad = (idx = 0) => {
      if (idx >= sources.length) {
        console.warn('Background audio: all candidate files failed to decode.');
        return;
      }

      audioLoader.load(
        sources[idx],
        (buffer) => {
          sound.setBuffer(buffer);
          sound.setLoop(true);
          sound.setVolume(0.5);
        },
        undefined,
        () => {
          // onError: try next source
          tryLoad(idx + 1);
        },
      );
    };

    tryLoad();

    this.ambientSound = sound;

    // Unlock audio on first user gesture if it was suspended
    // unlock/resume on user gesture but actual playback will start on first ship movement
    const resumeContext = () => {
      if (this.ambientSound && this.ambientSound.context.state === 'suspended') {
        this.ambientSound.context.resume();
      }
    };

    document.addEventListener('click', resumeContext);
    document.addEventListener('keydown', resumeContext);
  }

  private maybeStartAmbientSound(): void {
    if (this.ambientStarted || !this.ambientSound || !this.ship) return;

    const speed = this.ship.getCurrentSpeed();
    const minSpeed = 0.5; // small threshold to avoid starting while idle

    if (speed > minSpeed) {
      if (this.ambientSound.context.state === 'suspended') {
        // Wait until context resumed (handled by user gesture listener)
        return;
      }

      // @ts-ignore property not in typings
      if (!(this.ambientSound as any).isPlaying) {
        this.ambientSound.play();
      }
      this.ambientStarted = true;
    }
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

      // Attempt to start background sound when player starts moving
      this.maybeStartAmbientSound();
    }
    
    // Update islands
    for (const island of this.islands) {
      island.update(deltaTime);
    }
    
    // Animate Gerstner ocean
    if (
      this.ocean &&
      (this.ocean.material as THREE.MeshStandardMaterial).userData.shader
    ) {
      const shader: any = (this.ocean.material as THREE.MeshStandardMaterial).userData.shader;
      if (shader && shader.uniforms && shader.uniforms.uTime) {
        shader.uniforms.uTime.value += deltaTime;
      }
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