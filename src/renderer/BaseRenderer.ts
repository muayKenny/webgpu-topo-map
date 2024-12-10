import { ProcessedElevationData } from '../utils/elevationProcessor';

// src/renderers/BaseRenderer.ts
export interface BaseRenderer {
  initialize(): Promise<boolean>;
  setupGeometry(data: ProcessedElevationData): void;
  render(): void;
}

// src/renderers/Topo3DRenderer.ts
// export class Topo3DRenderer implements BaseRenderer {
//   // New 3D implementation we'll create
// }
