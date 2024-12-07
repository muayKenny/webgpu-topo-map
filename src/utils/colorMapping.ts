// src/utils/colorMapping.ts
interface RGB {
  r: number;
  g: number;
  b: number;
}

// Classic terrain color stops (elevation: RGB)
const TERRAIN_COLORS: [number, RGB][] = [
  [0.0, { r: 0.0, g: 0.44, b: 0.0 }], // Dark green for low elevations
  [0.3, { r: 0.15, g: 0.6, b: 0.15 }], // Green
  [0.5, { r: 0.7, g: 0.6, b: 0.35 }], // Light brown
  [0.7, { r: 0.6, g: 0.45, b: 0.3 }], // Brown
  [0.9, { r: 0.65, g: 0.65, b: 0.65 }], // Gray
  [1.0, { r: 1.0, g: 1.0, b: 1.0 }], // White for peaks
];

export function getColorForElevation(normalizedElevation: number): RGB {
  // Find the color stops we should interpolate between
  for (let i = 0; i < TERRAIN_COLORS.length - 1; i++) {
    const [stop1, color1] = TERRAIN_COLORS[i];
    const [stop2, color2] = TERRAIN_COLORS[i + 1];

    if (normalizedElevation >= stop1 && normalizedElevation <= stop2) {
      // Linear interpolation between the two colors
      const t = (normalizedElevation - stop1) / (stop2 - stop1);

      return {
        r: color1.r + (color2.r - color1.r) * t,
        g: color1.g + (color2.g - color1.g) * t,
        b: color1.b + (color2.b - color1.b) * t,
      };
    }
  }

  // Fallback to last color if something goes wrong
  return TERRAIN_COLORS[TERRAIN_COLORS.length - 1][1];
}

// Convert normalized elevations to color buffer for WebGPU
export function createColorBuffer(
  normalizedElevations: Float32Array
): Float32Array {
  // RGB for each elevation point (3 values per point)
  const colorBuffer = new Float32Array(normalizedElevations.length * 3);

  for (let i = 0; i < normalizedElevations.length; i++) {
    const color = getColorForElevation(normalizedElevations[i]);
    colorBuffer[i * 3] = color.r; // R
    colorBuffer[i * 3 + 1] = color.g; // G
    colorBuffer[i * 3 + 2] = color.b; // B
  }

  return colorBuffer;
}
