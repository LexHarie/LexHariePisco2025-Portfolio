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
  private currentSpeed: number = 0;
  
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
    
    // Configure physics body
    this.body.linearDamping = 0.7;
    this.body.angularDamping = 0.99;
    this.body.allowSleep = false;
    
    // Add the body to the world
    this.world.addBody(this.body);
    
    // Add the model to the scene
    this.scene.add(this.model);
    
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
  }
  
  private applyBuoyancy(): void {
    const waterLevel = 0;
    const halfH = this.shape.halfExtents.y;
    const depth = waterLevel - (this.body.position.y - halfH);
    const submerged = Math.max(0, Math.min(1, depth / (halfH * 2)));
  
    if (submerged === 0) return;
  
    // neutral buoyancy per Archimedes
    const F = -this.world.gravity.y * this.body.mass * submerged;  // ≈ 98 N when fully submerged
    this.body.applyForce(new CANNON.Vec3(0, F, 0), this.body.position);
  
    // quadratic water drag on horizontal motion
    const dragCoeff = 5;
    const horizVel = new CANNON.Vec3(this.body.velocity.x, 0, this.body.velocity.z);
    this.body.applyForce(horizVel.scale(-dragCoeff * submerged), this.body.position);
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
    // Apply slight bobbing effect based on tween
    this.model.position.y += this.bobbingParams.y * 0.5;
    
    // Add slight roll based on bobbing
    const rollAngle = (this.bobbingParams.y - 0.5) * 0.05;
    this.model.rotation.z += rollAngle;
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
    return this.isBoosting ? this.currentSpeed * this.boostMultiplier : this.currentSpeed;
  }
  
  public getStamina(): number {
    return this.stamina;
  }
  
  public getPhysicsBody(): CANNON.Body {
    return this.body;
  }
}