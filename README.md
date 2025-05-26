# Pirate Portfolio

An interactive, résumé-driven 3‑D website with a pirate theme. Explore a finite ocean with flying islands (résumé sections) and treasure chests (projects). The scene is viewed from a fixed isometric angle using an orthographic camera.

## Tech Stack

- Three.js (3D rendering)
- TypeScript
- Cannon-es (Physics)
- TweenJS (Animation)
- Vite (Build tool)

## Models

The following 3D models are used:
- `pirate_ship.glb` - Player avatar
- `pirate_island.glb` - Islands representing resume sections
- `greedy_octopuss_treasure_chest.glb` - Treasure chests representing projects

## Controls

- **W/A/S/D** - Move ship forward/left/backward/right
- **Mouse Wheel** - Zoom in/out
- **Shift** - Boost speed (drains stamina)
- **E** - Interact with islands and chests
- **Esc** - Close overlays

## Development

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
/
├── public/               # Static assets
│   ├── content/          # Resume content (markdown)
│   ├── models/           # 3D models (.glb)
│   └── textures/         # Textures for materials
│
├── src/                  # Source code
│   ├── controls/         # User input handling
│   ├── entities/         # Game objects (Ship, Island, Chest)
│   ├── ui/               # User interface components
│   ├── utils/            # Utility functions
│   ├── main.ts           # Entry point
│   └── world.ts          # Scene orchestration
│
├── index.html            # Main HTML file
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## Deployment

The site is configured for deployment on Cloudflare Pages:

1. Ensure your Cloudflare Pages project is connected to your repository
2. Configure the build command: `npm run build`
3. Set the output directory: `dist`

## Performance Considerations

The application is optimized to run at 60 FPS on a 2020 MacBook Pro:

- Uses THREE.InstancedMesh for repeating elements
- Implements frustum culling and dynamic LOD
- Uses object pooling for performance
- Limits pixel ratio to 1.5 for high-DPI displays
- Ensures GPU budget < 4ms, CPU budget < 6ms

## License

All rights reserved. This is a portfolio project and not open source.