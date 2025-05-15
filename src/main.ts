import * as THREE from 'three';
import World from './world';

// Global variable for debugging
declare global {
  interface Window { world: any; }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('DOMContentLoaded event fired');
    
    // Create loading screen
    const loadingScreen = document.createElement('div');
    loadingScreen.className = 'loading-screen';
    
    const loadingTitle = document.createElement('h1');
    loadingTitle.textContent = 'Pirate Portfolio';
    loadingTitle.style.marginBottom = '20px';
    
    const loadingBar = document.createElement('div');
    loadingBar.className = 'loading-bar';
    
    const loadingProgress = document.createElement('div');
    loadingProgress.className = 'loading-progress';
    
    loadingBar.appendChild(loadingProgress);
    loadingScreen.appendChild(loadingTitle);
    loadingScreen.appendChild(loadingBar);
    document.body.appendChild(loadingScreen);
    
    // Set up improved error handling for model loading
    const manager = THREE.DefaultLoadingManager;
    
    manager.onError = (url) => {
      console.error(`Error loading resource: ${url}`);
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'absolute';
      errorDiv.style.bottom = '10px';
      errorDiv.style.left = '10px';
      errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      errorDiv.style.color = 'white';
      errorDiv.style.padding = '10px';
      errorDiv.style.borderRadius = '5px';
      errorDiv.style.zIndex = '1000';
      errorDiv.textContent = `Failed to load: ${url}`;
      document.body.appendChild(errorDiv);
    };
    
    // Initialize the World with debug mode
    console.log('Creating world');
    const world = new World();
    world.debug = true; // Enable debug helpers
    window.world = world;
    
    // Update loading progress
    manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      console.log(`Loading progress: ${itemsLoaded}/${itemsTotal}`);
      const progress = itemsLoaded / itemsTotal;
      loadingProgress.style.width = `${progress * 100}%`;
    };
    
    // Start the world with a fallback if init fails
    world.init().catch(error => {
      console.error('Error initializing world:', error);
      throw error;
    }).then(() => {
      console.log('World initialized successfully');
      world.animate();
      
      // Add debug info
      const debugInfo = document.createElement('div');
      debugInfo.style.position = 'absolute';
      debugInfo.style.top = '10px';
      debugInfo.style.right = '10px';
      debugInfo.style.color = 'white';
      debugInfo.style.backgroundColor = 'rgba(0,0,0,0.5)';
      debugInfo.style.padding = '10px';
      debugInfo.style.borderRadius = '5px';
      debugInfo.textContent = 'Debug mode on - Press F12 for console';
      document.body.appendChild(debugInfo);
    });
    
    // Remove loading screen after a short delay
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.remove();
      }, 500);
    }, 1000);
    
    console.log('Initialization complete');
  } catch (error) {
    console.error('Error initializing application:', error);
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'absolute';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.padding = '20px';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorDiv.style.color = 'white';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.fontFamily = 'sans-serif';
    errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    document.body.appendChild(errorDiv);
  }
});

// Prevent context menu
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});