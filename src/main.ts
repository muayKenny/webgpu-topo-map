import { loadElevationData } from './utils/loadElevation';
import { processElevationData } from './utils/elevationProcessor';

import { Topo2DRenderer } from './2d/Topo2DRenderer';
import { Topo3DRenderer } from './renderer/Topo3DRenderer';
import {
  ComputeMethod,
  MeshGenerator,
} from './renderer/geometry/MeshGenerator';

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

    let currentRenderer: Topo2DRenderer | Topo3DRenderer;
    const elevationControl = document.getElementById(
      'elevationControl'
    ) as HTMLDivElement;
    const scaleSlider = document.getElementById(
      'elevationScale'
    ) as HTMLInputElement;
    const scaleValue = document.getElementById('scaleValue') as HTMLSpanElement;
    const computeSelector = document.getElementById(
      'computeMethod'
    ) as HTMLSelectElement;

    async function initializeRenderer(type: '2D' | '3D') {
      if (type === '2D') {
        currentRenderer = new Topo2DRenderer('topoCanvas');
        elevationControl.style.display = 'none';
      } else {
        const selectedMethod = computeSelector.value as ComputeMethod;

        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter?.requestDevice();
        if (!device) {
          console.error('WebGPU is not supported on this browser.');
          return;
        }

        const meshGenerator = new MeshGenerator(2, selectedMethod);

        currentRenderer = new Topo3DRenderer(
          'topoCanvas',
          meshGenerator,
          device
        );

        elevationControl.style.display = 'block';
      }

      const initialized = await currentRenderer.initialize();
      if (initialized) {
        await currentRenderer.setupGeometry(processed);
        currentRenderer.render();
        return true;
      }
      return false;
    }

    // Set up button handlers
    const btn2D = document.getElementById('render2D') as HTMLButtonElement;
    const btn3D = document.getElementById('render3D') as HTMLButtonElement;

    const updateButtons = (active: '2D' | '3D') => {
      btn2D.classList.toggle('active', active === '2D');
      btn3D.classList.toggle('active', active === '3D');
    };

    computeSelector.addEventListener('change', async () => {
      await initializeRenderer('3D');
    });

    scaleSlider.addEventListener('input', () => {
      const scale = parseFloat(scaleSlider.value);
      scaleValue.textContent = scale.toString();
      if (currentRenderer instanceof Topo3DRenderer) {
        currentRenderer.updateElevationScale(scale);
      }
    });

    btn2D.addEventListener('click', async () => {
      await initializeRenderer('2D');
      updateButtons('2D');
    });

    btn3D.addEventListener('click', async () => {
      await initializeRenderer('3D');
      updateButtons('3D');
    });

    // Initialize with 3D view by default
    await initializeRenderer('3D');
    updateButtons('3D');
  } catch (error) {
    console.error('Error loading elevation data:', error);
  }
}

main();
