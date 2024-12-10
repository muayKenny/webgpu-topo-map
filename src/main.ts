// src/main.ts
import { loadElevationData } from './utils/loadElevation';
import { processElevationData } from './utils/elevationProcessor';

// import { Topo2DRenderer } from './renderer/Topo2DRenderer';
import { Topo3DRenderer } from './renderer/Topo3DRenderer';

/* elevation.tiff: */
// https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?
// bbox=-77,40,-76,41      # Bounding box: min_long,min_lat,max_long,max_lat
// &bboxSR=4326           # Spatial Reference: 4326 means we're using lat/long coordinates
// &size=256,256          # Output image size in pixels
// &format=tiff           # Output format (could also be png, jpg, etc but tiff gives us raw values)
// &pixelType=F32         # 32-bit floating point values for elevation
// &f=image              # Return format - 'image' means return the actual file

async function main() {
  try {
    const elevationData = await loadElevationData('/data/elevation.tiff');
    const processed = processElevationData(elevationData);

    console.dir(processed, { depth: true });

    // const renderer2D = new Topo2DRenderer('topoCanvas2D');
    // const renderer3D = new Topo3DRenderer('topoCanvas3D');
    const renderer = new Topo3DRenderer('topoCanvas');
    const initialized = await renderer.initialize();

    if (initialized) {
      console.log('WebGPU initialized successfully');
      renderer.setupGeometry(processed);
      renderer.render();
    } else {
      console.error('Failed to initialize WebGPU');
    }
  } catch (error) {
    console.error('Error loading elevation data:', error);
  }
}

main();
