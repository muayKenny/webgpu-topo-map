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
    // const scaleSlider = document.getElementById(
    //   'elevationScale'
    // ) as HTMLInputElement;
    // const scaleValue = document.getElementById('scaleValue') as HTMLSpanElement;
    const computeSelector = document.getElementById(
      'computeMethod'
    ) as HTMLSelectElement;

    async function initializeRenderer(type: '2D' | '3D') {
      const selectedMethod = computeSelector.value as ComputeMethod;

      if (type === '2D') {
        currentRenderer = new Topo2DRenderer('topoCanvas');
      } else {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.error('WebGPU is not supported on this browser.');
          return;
        }

        // set up requesting a large buffer limit from the GPU.
        const w = processed.dimensions.width; // original grid width
        const h = processed.dimensions.height; // original grid height
        const tesselationFactor = 7; // tessellation factor you decided on
        const floatsPerVertex = 9; // pos (3) + normal (3) + color (3)
        const gridW = (w - 1) * tesselationFactor + 1;
        const gridH = (h - 1) * tesselationFactor + 1;
        const vertexCount = gridW * gridH;
        const vboBytes = vertexCount * floatsPerVertex * 4;

        const REQUIRED_CAP = 256 * 1024 * 1024;
        const limits =
          vboBytes > REQUIRED_CAP
            ? {
                maxBufferSize: Math.min(vboBytes, adapter.limits.maxBufferSize),
              }
            : {};

        const device = await adapter.requestDevice({ requiredLimits: limits });

        const meshGenerator = new MeshGenerator(
          tesselationFactor,
          selectedMethod
        );

        currentRenderer = new Topo3DRenderer(
          'topoCanvas',
          meshGenerator,
          device
        );

        // elevationControl.style.display = 'block';
      }

      const initialized = await currentRenderer.initialize();
      if (initialized) {
        if (
          selectedMethod === ComputeMethod.GPU &&
          currentRenderer instanceof Topo3DRenderer
        ) {
          await currentRenderer.setupGeometryGPUCompute(processed);
        } else {
          await currentRenderer.setupGeometry(processed);
        }
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

    // scaleSlider.addEventListener('input', () => {
    //   const scale = parseFloat(scaleSlider.value);
    //   scaleValue.textContent = scale.toString();
    //   if (currentRenderer instanceof Topo3DRenderer) {
    //     currentRenderer.updateElevationScale(scale);
    //   }
    // });

    btn2D.addEventListener('click', async () => {
      await initializeRenderer('2D');
      updateButtons('2D');
    });

    btn3D.addEventListener('click', async () => {
      await initializeRenderer('3D');
      updateButtons('3D');
    });

    // ----------------------------- STATE ---------------------------------
    const periodMs = 10_000; // full cycle = 10 s
    let currentScale = 0.1; // starting value
    let animId: number | null = null;
    // ---------------------------------------------------------------------

    function applyScale(scale: number) {
      currentScale = scale;

      // feed the renderer
      if (currentRenderer instanceof Topo3DRenderer) {
        currentRenderer.updateElevationScale(scale);
      }

      // optional: print or overlay the value somewhere
      console.debug('elevationScale =', scale.toFixed(3));
    }

    function animate(t: number) {
      // 0 → 1 → 0 cosine wave centred on currentScale’s base point
      const phase = (t % periodMs) / periodMs; // 0 … 1
      const angle = phase * 2 * Math.PI; // 0 … 2π
      const scale = 0.5 * (1 - Math.cos(angle)); // 0 → 1 → 0

      applyScale(scale); // <- key call
      animId = requestAnimationFrame(animate);
    }

    // --------------------------- CONTROLS --------------------------------
    function startWave(): void {
      if (animId === null) {
        animId = requestAnimationFrame(animate);
      }
    }

    function stopWave(): void {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      // hold whatever value the wave ended on
    }

    // quick manual nudge helpers (optional)
    function nudgeUp(d = 0.01) {
      applyScale(Math.min(1, currentScale + d));
    }
    function nudgeDown(d = 0.01) {
      applyScale(Math.max(0, currentScale - d));
    }

    // ---------------------------------------------------------------------
    // Example: wire keyboard arrows for nudging
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') nudgeUp();
      if (e.key === 'ArrowDown') nudgeDown();
    });

    // ---------------------------------------------------------------------
    // call startWave() / stopWave() from your Start / Stop buttons

    const btnStart = document.getElementById('startWave') as HTMLButtonElement;
    const btnStop = document.getElementById('stopWave') as HTMLButtonElement;

    btnStart.addEventListener('click', startWave);
    btnStop.addEventListener('click', stopWave);
    // Initialize with 3D view by default
    await initializeRenderer('3D');
    updateButtons('3D');
  } catch (error) {
    console.error('Error loading elevation data:', error);
  }
}

main();
