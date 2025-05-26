import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';

export class Ship {
  // Three.js model and components
  private model: THREE.Group;
  private scene: THREE.Scene;
  
  // Physics
  private world: CANNON.World;
  private body: CANNON.Body;
  private shape: CANNON.Box;
  
  // Movement
  private acceleration: number = 15;
  private rotationSpeed: number = Math.PI / 4; // 45 degrees per second
  
  // Stamina
  private stamina: number = 1.0;
  private staminaDrainRate: number = 0.2;
  private staminaRegenRate: number = 0.1;
  private boostMultiplier: number = 1.8;
  private isBoosting: boolean = false;
  
  // Movement state
  private movementDirection = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
  
  // Effects
  private bobbingParams = { y: 0 };

  // Water spray sprite
  private spraySprite: THREE.Sprite | null = null;

  // wake trail
  private wakeSegments: Array<{ mesh: THREE.Mesh; age: number }> = [];
  private wakeSpawnTimer = 0;
  
  constructor(model: THREE.Group, scene: THREE.Scene, world: CANNON.World) {
    this.model = model;
    this.scene = scene;
    this.world = world;
    
    // Scale the ship model
    this.model.scale.set(20, 20, 20);
    
    // Set up physics body
    this.shape = new CANNON.Box(new CANNON.Vec3(8, 3, 15));
    this.body = new CANNON.Body({
      mass: 10,
      position: new CANNON.Vec3(0, 10, 0), // Start higher above water
      shape: this.shape,
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.3
      })
    });
    
    // Configure physics body with lower damping
    this.body.linearDamping = 0.25;
    this.body.angularDamping = 0.35;
    this.body.allowSleep = false;
    
    // Set higher initial position to give the ship more room to fall and stabilize
    this.body.position.set(0, 5, 0);
    
    // Allow yaw (Y-axis rotation) only, block pitch and roll
    this.body.angularFactor.set(0, 1, 0);
    
    // Add the body to the world
    this.world.addBody(this.body);
    
    // Add event listener to neutralize any residual tilt after physics step
    this.world.addEventListener('postStep', () => {
      // Get current rotation as axis/angle
      const axis = new CANNON.Vec3();
      
      // If rotation is primarily around Y axis, keep it as is
      // Otherwise, reset rotation to keep only the Y component
      if (Math.abs(axis.y) < 0.9) { // If not primarily rotating around Y
        // Extract rotation around Y axis using body's euler angles
        const euler = new CANNON.Vec3();
        this.body.quaternion.toEuler(euler);
        
        // Create new quaternion with only Y rotation
        const fixedQuaternion = new CANNON.Quaternion();
        fixedQuaternion.setFromEuler(0, euler.y, 0);
        this.body.quaternion.copy(fixedQuaternion);
      }
    });
    
    // Add the model to the scene
    this.scene.add(this.model);

    // ------------------------------------------------
    // Generate a simple radial-gradient texture on the fly so we do not rely
    // on any external image assets.
    // ------------------------------------------------
    const generateRadialTexture = (): THREE.Texture => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to empty texture
        return new THREE.Texture();
      }
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const sprayMaterial = new THREE.SpriteMaterial({
      map: generateRadialTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.spraySprite = new THREE.Sprite(sprayMaterial);
    this.spraySprite.scale.set(20, 20, 1); // Adjust size as needed
    this.model.add(this.spraySprite);
    
    // Update model position to match initial body position
    this.model.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    
    // Set up bobbing effect
    this.setupBobbingEffect();
  }
  
  private setupBobbingEffect(): void {
    // Create the bobbing animation
    new TWEEN.Tween(this.bobbingParams)
      .to({ y: 1 }, 2000)
      .repeat(Infinity)
      .yoyo(true)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .start();
  }
  
  public update(deltaTime: number): void {
    // Apply water buoyancy (simplified)
    this.applyBuoyancy();
    
    // Apply movement forces
    this.handleMovement();
    
    // Update physics to visual position and rotation
    this.updateTransform();
    
    // Update bobbing effect
    this.applyBobbingEffect();
    
    // Update stamina
    this.updateStamina(deltaTime);

    // Update water spray visual
    this.updateSprayEffect();

    // Wake trail spawning & update
    this.updateWake(deltaTime);
  }
  
  private applyBuoyancy(): void {
    const waterLevel = 0;
    const halfH = this.shape.halfExtents.y;
    const depth = waterLevel - (this.body.position.y - halfH);
    const submerged = Math.max(0, Math.min(1, depth / (halfH * 2)));
  
    if (submerged === 0) return;
  
    // Enhanced buoyancy - multiply by 1.5 to create extra lift
    // This ensures the ship floats higher in the water rather than sitting at neutral buoyancy
    const buoyancyMultiplier = 1.5; // Increase for higher floating position
    const F = -this.world.gravity.y * this.body.mass * submerged * buoyancyMultiplier;
    this.body.applyForce(new CANNON.Vec3(0, F, 0), this.body.position);
    
    // NOTE: We intentionally omit vertical damping and horizontal drag so that
    // the player can navigate freely without "fighting" ocean resistance.
  }
  
  
private handleMovement(): void {
  const thrust = (this.isBoosting ? this.acceleration * this.boostMultiplier
                                   : this.acceleration) * this.body.mass;

  // forward vector in world space
  const fwd = new CANNON.Vec3(0, 0, -1);   // model faces –Z for Three.js ships
  this.body.quaternion.vmult(fwd, fwd);

  if (this.movementDirection.forward)
      this.body.applyForce(fwd.scale(thrust), this.body.position);
  if (this.movementDirection.backward)
      this.body.applyForce(fwd.scale(-thrust * 0.5), this.body.position);

  // yaw control via angular velocity, not torque impulses
  const yawRate = this.rotationSpeed;
  if (this.movementDirection.left)        this.body.angularVelocity.y =  yawRate;
  else if (this.movementDirection.right)  this.body.angularVelocity.y = -yawRate;
  else                                    this.body.angularVelocity.y *= 0.9;
}

  
  private updateTransform(): void {
    // Update position
    this.model.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    
    // Update rotation
    this.model.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
  }
  
  private applyBobbingEffect(): void {
    // Apply slight bobbing effect based on tween - visual only, doesn't affect physics
    this.model.position.y += this.bobbingParams.y * 0.3;
    
    // Visual-only roll effect (doesn't affect physics body rotation)
    const rollAngle = (this.bobbingParams.y - 0.5) * 0.02;
    
    // Get current body quaternion for base rotation
    const bodyQuat = this.body.quaternion;
    
    // Extract yaw rotation to use with visual roll
    const euler = new CANNON.Vec3();
    bodyQuat.toEuler(euler);
    
    // Create a THREE.js quaternion for the visual model
    // First apply the physics body's yaw
    const modelQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      euler.y
    );
    
    // Then apply visual roll for bobbing effect
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      rollAngle
    );
    
    // Combine the rotations
    this.model.quaternion.copy(modelQuat.multiply(rollQuat));
  }
  
  private updateStamina(deltaTime: number): void {
    if (this.isBoosting && this.movementDirection.forward) {
      // Drain stamina when boosting
      this.stamina -= this.staminaDrainRate * deltaTime;
      this.stamina = Math.max(0, this.stamina);
      
      // Disable boost if stamina is depleted
      if (this.stamina <= 0) {
        this.isBoosting = false;
      }
    } else {
      // Regenerate stamina when not boosting
      this.stamina += this.staminaRegenRate * deltaTime;
      this.stamina = Math.min(1, this.stamina);
    }
  }
  
  public setMovementDirection(direction: 'forward' | 'backward' | 'left' | 'right', active: boolean): void {
    this.movementDirection[direction] = active;
  }
  
  public setBoost(active: boolean): void {
    // Only allow boosting if there's enough stamina
    this.isBoosting = active && this.stamina > 0.1;
  }
  
  public get position(): THREE.Vector3 {
    return this.model.position;
  }
  
  public getRotation(): number {
    return this.model.rotation.y;
  }
  
  public getCurrentSpeed(): number {
    // Calculate actual speed from velocity magnitude
    const velocity = this.body.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    
    return this.isBoosting ? speed * this.boostMultiplier : speed;
  }
  
  public getStamina(): number {
    return this.stamina;
  }
  
  public getPhysicsBody(): CANNON.Body {
    return this.body;
  }

  // --------------------------------------------------
  // Water-spray helper
  // --------------------------------------------------
  private updateSprayEffect(): void {
    if (!this.spraySprite) return;

    // Calculate current speed on XZ plane
    const velocity = this.body.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    // Show spray if moving forward fast enough
    const speedThreshold = 8; // tune as desired
    const targetOpacity = speed > speedThreshold ? 0.8 : 0.0;

    // Smooth interpolation for opacity
    const material = this.spraySprite.material as THREE.SpriteMaterial;
    material.opacity += (targetOpacity - material.opacity) * 0.1;

    // Position the sprite at the bow (front) of the ship
    // Assuming the model faces –Z as above
    const bowOffset = new THREE.Vector3(0, 5, -25); // slightly above and ahead
    bowOffset.applyQuaternion(this.model.quaternion);
    this.spraySprite.position.copy(bowOffset);

    // Orient sprite to always face camera (behaviour of sprite by default)
  }

  // --------------------------------------------------
  // Wake trail behind the ship
  // --------------------------------------------------
  private updateWake(deltaTime: number): void {
    const speed = Math.sqrt(
      this.body.velocity.x * this.body.velocity.x +
        this.body.velocity.z * this.body.velocity.z,
    );

    // Spawn new wake segments based on speed and timer
    this.wakeSpawnTimer += deltaTime;
    const spawnInterval = 0.12; // seconds between spawn when moving
    const speedThreshold = 4; // minimal speed to spawn wake

    if (speed > speedThreshold && this.wakeSpawnTimer >= spawnInterval) {
      this.spawnWakeSegment();
      this.wakeSpawnTimer = 0;
    }

    // Update existing wake segments
    const fadeDuration = 3.5; // seconds until fully faded & removed

    for (let i = this.wakeSegments.length - 1; i >= 0; i--) {
      const segment = this.wakeSegments[i];
      segment.age += deltaTime;

      const progress = segment.age / fadeDuration;

      if (progress >= 1) {
        // Remove from scene and array
        this.scene.remove(segment.mesh);
        this.wakeSegments.splice(i, 1);
        continue;
      }

      // Gradually expand and fade
      const scaleFactor = 1 + progress * 1.5; // enlarge over time
      segment.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

      const material = segment.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = (1 - progress) * 0.4;
    }
  }

  private spawnWakeSegment(): void {
    // Create texture only once and reuse
    const texture = this.getWakeTexture();

    const geom = new THREE.PlaneGeometry(20, 40);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.4,
    });

    const mesh = new THREE.Mesh(geom, mat);

    // Position behind ship
    const offset = new THREE.Vector3(0, 0.1, 25); // some distance behind (positive Z because ship faces -Z)
    offset.applyQuaternion(this.model.quaternion);
    mesh.position.copy(this.model.position.clone().add(offset));

    // Orient so it lies flat on water
    mesh.rotation.x = -Math.PI / 2;

    // Rotate so that long side aligns with ship direction
    mesh.rotation.z = this.model.rotation.y;

    this.scene.add(mesh);

    this.wakeSegments.push({ mesh, age: 0 });
  }

  // create / cache radial gradient texture for wake segments
  private static _wakeTexture: THREE.Texture | null = null;
  private getWakeTexture(): THREE.Texture {
    if (Ship._wakeTexture) return Ship._wakeTexture;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // linear gradient along Y from white to transparent for elongated wake
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;

    Ship._wakeTexture = texture;
    return texture;
  }
}