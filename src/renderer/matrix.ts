export interface Mat4 {
  elements: Float32Array;
}

export const createMat4 = (): Mat4 => ({
  elements: new Float32Array([
    1, // x column 1
    0,
    0,
    0,
    0, // y column 2
    1,
    0,
    0,
    0, // y column 3
    0,
    1,
    0,
    0, // translation column 4
    0,
    0,
    1,
  ]),
});

export const createViewMatrix = (
  angleX: number = 45,
  angleY: number = 45, // look down
  distance: number = 3
): Mat4 => {
  const matrix = createMat4();
  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;

  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);

  // Create view matrix - this is like positioning a camera
  const elements = [
    cosY,
    sinX * sinY,
    -cosX * sinY,
    0,
    0,
    cosX,
    sinX,
    0,
    sinY,
    -sinX * cosY,
    cosX * cosY,
    0,
    0,
    0,
    -distance,
    1,
  ];

  matrix.elements.set(elements);
  return matrix;
};

// Helper to convert matrix to WebGPU-friendly Float32Array
export const matrixToFloat32Array = (matrix: Mat4): Float32Array => {
  return matrix.elements;
};
