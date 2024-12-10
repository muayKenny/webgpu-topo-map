export interface Mat4 {
  elements: Float32Array;
}

export const createLookAtMatrix = (
  eye: [number, number, number], // Camera position
  target: [number, number, number], // Look-at point
  up: [number, number, number] // Up vector
): Mat4 => {
  const [ex, ey, ez] = eye;
  const [tx, ty, tz] = target;
  const [ux, uy, uz] = up;

  // Compute forward (camera's z-axis)
  const forward = normalize([tx - ex, ty - ey, tz - ez]);

  // Compute right (camera's x-axis)
  const right = normalize(cross(forward, up));

  // Compute true up (camera's y-axis)
  const trueUp = cross(right, forward);

  // Build the view matrix
  const elements = new Float32Array([
    right[0],
    trueUp[0],
    -forward[0],
    0,
    right[1],
    trueUp[1],
    -forward[1],
    0,
    right[2],
    trueUp[2],
    -forward[2],
    0,
    -dot(right, eye),
    -dot(trueUp, eye),
    dot(forward, eye),
    1,
  ]);

  return { elements };
};

// Normalize a vector
const normalize = (v: [number, number, number]): [number, number, number] => {
  const length = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / length, v[1] / length, v[2] / length];
};

// Compute the cross product of two vectors
const cross = (
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] => {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
};

// Compute the dot product of two vectors
const dot = (
  a: [number, number, number],
  b: [number, number, number]
): number => {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

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
