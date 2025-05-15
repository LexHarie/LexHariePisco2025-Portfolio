# Pirate Portfolio

This is an interactive 3D portfolio website themed around pirates and islands, built with Three.js and Cannon.js.

## Features
- Navigate a 3D pirate island environment using keyboard (WASD/Arrow keys) and mouse.
- Explore different islands representing resume sections (About, Skills, Experience, Projects).
- Open interactive treasure chests on the Projects island to view detailed project information.
- Physics-based interactions for realistic object behaviors.
- Minimal UI overlay for essential information.

## Prerequisites
- A local HTTP server is required to serve ES modules (e.g., via Node.js `http-server`, Python, or Vite).

## Running Locally

### Option 1: Node.js http-server
1. Install http-server globally (if not already installed):
   ```bash
   npm install -g http-server
   ```
2. From the project root, start the server:
   ```bash
   http-server .
   ```
3. Open your browser and navigate to the displayed address (e.g., http://127.0.0.1:8080).

### Option 2: Python HTTP server
1. Ensure you have Python 3 installed.
2. From the project root, run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser at http://localhost:8000.

### Option 3: Vite Dev Server
1. Ensure Node.js (v14+) is installed.
2. From the project root, install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Your browser should automatically open at http://localhost:3000. If not, navigate there manually.
5. Click on the canvas to lock the pointer, then use WASD or arrow keys and mouse to explore.

## Deployment
For production, use a static site host (e.g., GitHub Pages, Netlify, Vercel) that serves the `index.html` and asset directories.

## Customization
- Place your 3D models under `assets/models/` as `pirate_island.glb` and `treasure_chest.glb`. If using Vite, ensure your `vite.config.js` has `publicDir: 'assets'` (the default), so that the `assets/` folder is served as the root of static files.
- Adjust positions and project details in `js/assetsLoader.js` and `js/chest.js`.

Enjoy exploring your pirate-themed portfolio!