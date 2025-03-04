export class TopoGPUCompute {
  private device: GPUDevice;
  private pipeline: GPUComputePipeline | null = null;
  private inputBuffer: GPUBuffer | null = null;
  public vertexBuffer: GPUBuffer | null = null; // Used for rendering
  public normalBuffer: GPUBuffer | null = null;
  public colorBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  async initialize(width: number, height: number): Promise<void> {
    const vertexCount = width * height;
    const bufferSize = vertexCount * 4 * Float32Array.BYTES_PER_ELEMENT; // 4 floats per vertex

    this.inputBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.vertexBuffer = this.device.createBuffer({
      size: bufferSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_SRC,
    });

    this.normalBuffer = this.device.createBuffer({
      size: vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT, // 3 floats per normal
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_SRC,
    });

    this.colorBuffer = this.device.createBuffer({
      size: vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT, // 3 floats per color
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_SRC,
    });

    const shaderModule = this.device.createShaderModule({
      code: `@group(0) @binding(0) var<storage, read> elevations: array<f32>; // Elevation data
@group(0) @binding(1) var<storage, read_write> vertexBuffer: array<vec4<f32>>; // Output vertex positions
@group(0) @binding(2) var<storage, read_write> normalBuffer: array<vec3<f32>>; // Output normals
@group(0) @binding(3) var<storage, read_write> colorBuffer: array<vec3<f32>>; // Output colors
@group(0) @binding(4) var<uniform> dimensions: vec2<u32>; // Width & height

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    let width = dimensions.x;
    let height = dimensions.y;

    if (index >= width * height) {
        return;
    }

    let x = f32(index % width);
    let y = f32(index / width);

    // Normalize x, y to [-1,1] range
    let xPos = (x / f32(width - 1)) * 2.0 - 1.0;
    let yPos = (y / f32(height - 1)) * 2.0 - 1.0;

    // Sample elevation from buffer
    let zPos = elevations[index];

    // Store vertex position
    vertexBuffer[index] = vec4<f32>(xPos, yPos, zPos, 1.0);

    // Compute normal by sampling neighboring points
    if (x < f32(width - 1) && y < f32(height - 1)) {
        let z1 = elevations[index];
        let z2 = elevations[index + 1];
        let z3 = elevations[index + width];

        let edge1 = vec3<f32>(1.0, 0.0, z2 - z1);
        let edge2 = vec3<f32>(0.0, 1.0, z3 - z1);

        let normal = normalize(cross(edge1, edge2));
        normalBuffer[index] = normal;
    } else {
        normalBuffer[index] = vec3<f32>(0.0, 0.0, 1.0);
    }

    // Compute color (placeholder, replace with actual logic)
    colorBuffer[index] = vec3<f32>(zPos, zPos, zPos); // Example: grayscale height
}`,
    });

    this.pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'main' },
    });

    console.log('✅ GPU Compute Initialized');
  }

  async runComputeShader(
    elevations: Float32Array,
    width: number,
    height: number
  ): Promise<void> {
    if (!this.pipeline || !this.inputBuffer || !this.vertexBuffer) {
      throw new Error('GPU Compute Pipeline not initialized.');
    }

    const start = performance.now();

    const inputArrayBuffer = this.device.createBuffer({
      size: elevations.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(inputArrayBuffer.getMappedRange()).set(elevations);
    inputArrayBuffer.unmap();

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputArrayBuffer! } },
        { binding: 1, resource: { buffer: this.vertexBuffer! } },
        { binding: 2, resource: { buffer: this.normalBuffer! } },
        { binding: 3, resource: { buffer: this.colorBuffer! } },
        {
          binding: 4,
          resource: { buffer: this.createUniformBuffer(width, height) },
        },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(elevations.length / 64));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    console.log(
      `🔥 V0.1 Shader Compute Mesh Generation Time: ${(
        performance.now() - start
      ).toFixed(4)}ms`
    );
    console.log('Rough.  Includes CPU overhead time');
  }

  private createUniformBuffer(width: number, height: number): GPUBuffer {
    const uniformData = new Uint32Array([width, height]);
    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Uint32Array(uniformBuffer.getMappedRange()).set(uniformData);
    uniformBuffer.unmap();

    return uniformBuffer;
  }
}
