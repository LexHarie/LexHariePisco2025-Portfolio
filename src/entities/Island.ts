import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';

/**
 * Island class representing interactive islands in the ocean
 * Each island displays information about work experience
 */
export class Island {
  // Type of island (not currently used but kept for future expansion)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // Experience job title
  private jobTitle: string;
  // Experience company
  private company: string;

  // Three.js model and components
  private model: THREE.Group;
  private scene: THREE.Scene;
  private titleMesh: THREE.Mesh | null = null;
  
  // Physics
  private world: CANNON.World;
  private body: CANNON.Body;
  
  // Position and state
  private _position: THREE.Vector3 = new THREE.Vector3();
  private active: boolean = true;
  private seed: number;
  
  // Floating animation
  private floatingParams = { y: 0 };
  
  constructor(
    model: THREE.Group, 
    scene: THREE.Scene, 
    world: CANNON.World, 
    jobTitle: string,
    company: string
  ) {
    this.model = model;
    this.scene = scene;
    this.world = world;
    this.jobTitle = jobTitle;
    this.company = company;
    this.seed = Math.random() * 1000;
    
    // Scale the island model (reduced size)
    const scale = 75;
    this.model.scale.set(scale, scale, scale);
    
    
    // Simplified physics body - cylinder is already Z-aligned in Cannon
    const r = scale * 0.4;
    const shape = new CANNON.Cylinder(r, r, 15, 8);
    this.body = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(0, 0, 0), // Center on the water
      shape,
      material: new CANNON.Material({
        friction: 0.5,
        restitution: 0.3
      })
    });
    
    // Apply a random rotation around Y axis only for variation
    const yRotation = new CANNON.Quaternion();
    yRotation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.random() * Math.PI * 2);
    this.body.quaternion.copy(yRotation);
    // Apply the same rotation to the model so it aligns visually with the physics body
    this.model.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    
    // Add the model to the scene and body to the world
    this.scene.add(this.model);
    this.world.addBody(this.body);
    
    // Set up the floating animation
    this.setupFloatingAnimation();
    
    // Create title mesh
    this.createTitleMesh();
  }
  
  private setupFloatingAnimation(): void {
    // Create the floating animation with a random phase offset based on seed
    new TWEEN.Tween(this.floatingParams)
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
    canvas.width = 512; // Larger canvas for more text
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    
    // Clear the canvas
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add rounded rectangle background
    context.beginPath();
    context.roundRect(10, 10, canvas.width-20, canvas.height-20, 10);
    context.fill();
    
    // Add company text
    context.font = 'bold 45px "Pirate Font", "Palatino Linotype", serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(this.company, canvas.width / 2, canvas.height / 3);
    
    // Add job title
    context.font = 'bold 35px "Pirate Font", "Times New Roman", serif';
    context.fillText(this.jobTitle, canvas.width / 2, (canvas.height / 3) * 2);
    
    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create a billboard mesh
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    // Banner size - adjusted smaller to fit island
    const bannerWidth = 8/2;
    const bannerHeight = 4/2;
    const geometry = new THREE.PlaneGeometry(bannerWidth, bannerHeight);
    this.titleMesh = new THREE.Mesh(geometry, material);
    // Position banner slightly above island top
    this.titleMesh.position.y = bannerHeight; 
    
    // Add to the model
    this.model.add(this.titleMesh);
  }
  
  public update(_deltaTime: number): void {
    if (!this.active) return;
    
    // Apply floating effect to the model's position, not affecting physics body
    this.model.position.x = this.body.position.x;
    this.model.position.y = this.body.position.y + this.floatingParams.y * 1.5; // Increased amplitude
    this.model.position.z = this.body.position.z;
    // Ensure the model rotation matches the physics body's Y-axis rotation
    this.model.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    
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
  
  /**
   * Returns if the island is active
   */
  public isActive(): boolean {
    return this.active;
  }
  
  /**
   * Returns the company name for this island
   */
  public getCompany(): string {
    return this.company;
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
    // Create pirate scroll overlay
    const scrollOverlay = document.createElement('div');
    scrollOverlay.className = 'pirate-scroll-overlay';
    
    // Create scroll container with the scroll image background
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'pirate-scroll';
    scrollContainer.style.backgroundImage = 'url("/assets/vecteezy_ai-generated-parchment-scroll-ancient-papyrus-png-isolated_36421503.png")';
    
    // Add content area that will be scrollable
    const scrollContent = document.createElement('div');
    scrollContent.className = 'pirate-scroll-content';
    
    // Add job title and company header
    const header = document.createElement('div');
    header.className = 'pirate-scroll-header';
    header.innerHTML = `<h1>${this.jobTitle}</h1><h2>${this.company}</h2>`;
    scrollContent.appendChild(header);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'pirate-scroll-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
      // Enable ship controls again
      const shipControlsElement = document.querySelector('.ship-controls');
      if (shipControlsElement) {
        shipControlsElement.classList.remove('disabled');
      }
      
      // Remove scroll with fade-out animation
      scrollOverlay.classList.add('fade-out');
      setTimeout(() => {
        scrollOverlay.remove();
      }, 500); // Match with CSS animation duration
      
      // Reduce background blur gradually
      const renderer = document.querySelector('canvas');
      if (renderer) {
        renderer.style.filter = 'blur(2px)';
        setTimeout(() => {
          renderer.style.filter = '';
        }, 500);
      }
    });
    
    // Fetch and render content for the specific company
    fetch('/content/experience.md')
      .then(response => response.text())
      .then(markdown => {
        // Extract only the relevant experience section based on company name
        const relevantSection = this.extractCompanySection(markdown, this.company);
        
        // Parse markdown to HTML
        const html = this.parseMarkdown(relevantSection);
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'pirate-scroll-experience';
        contentContainer.innerHTML = html;
        
        // Add to scroll content
        scrollContent.appendChild(contentContainer);
        
        // Add a signature at the bottom for decoration
        const signature = document.createElement('div');
        signature.className = 'pirate-signature';
        signature.textContent = '~ Captain Lex Pisco';
        scrollContent.appendChild(signature);
      })
      .catch(error => {
        scrollContent.innerHTML += `<div class="error"><h3>Error loading content</h3><p>${error.message}</p></div>`;
      });
    
    // Add elements to DOM
    scrollContainer.appendChild(scrollContent);
    scrollContainer.appendChild(closeButton);
    scrollOverlay.appendChild(scrollContainer);
    document.body.appendChild(scrollOverlay);
    
    // Add keyboard handler for ESC key
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeButton.click();
        document.removeEventListener('keydown', handleEscKey);
      }
    };
    document.addEventListener('keydown', handleEscKey);
    
    // Add blur effect to background
    const renderer = document.querySelector('canvas');
    if (renderer) {
      renderer.style.filter = 'blur(5px)';
    }
    
    // Disable ship controls while viewing scroll
    const shipControlsElement = document.querySelector('.ship-controls');
    if (shipControlsElement) {
      shipControlsElement.classList.add('disabled');
    }
    
    // Add fade-in animation
    setTimeout(() => {
      scrollOverlay.classList.add('active');
    }, 10);
  }
  
  /**
   * Extracts the section of markdown that corresponds to the given company
   */
  private extractCompanySection(markdown: string, companyName: string): string {
    const lines = markdown.split('\n');
    let extractedContent = '';
    let inCompanySection = false;
    // Variable to track when we've found the next company (not currently used but kept for clarity)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let nextCompanyFound = false;
    
    // Look for the company name in h2 headers
    for (const line of lines) {
      // Check if we found the company section
      if (line.includes(companyName)) {
        inCompanySection = true;
        extractedContent += line + '\n';
        continue;
      }
      
      // If we're in the target company section but find another h2,
      // we've reached the end of our target section
      if (inCompanySection && line.startsWith('## ') && !line.includes(companyName)) {
        nextCompanyFound = true;
        break;
      }
      
      // Add the line if we're in the right company section
      if (inCompanySection) {
        extractedContent += line + '\n';
      }
    }
    
    // If we didn't find the company or any content, return generic message
    if (!inCompanySection || extractedContent.trim() === '') {
      return `## ${companyName}\n\nNo detailed information available.`;
    }
    
    return extractedContent;
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