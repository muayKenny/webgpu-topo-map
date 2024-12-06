// src/main.ts
import { TopoRenderer } from './TopoRenderer';

async function main() {
  const renderer = new TopoRenderer('topoCanvas');
  const initialized = await renderer.initialize();

  if (initialized) {
    console.log('WebGPU initialized successfully');
    renderer.render();
  } else {
    console.error('Failed to initialize WebGPU');
  }
}

main();
