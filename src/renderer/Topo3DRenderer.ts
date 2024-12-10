import { getColorForElevation } from '../utils/colorMapping';
import { ProcessedElevationData } from '../utils/elevationProcessor';
// import { createColorBuffer } from '../utils/colorMapping';

export class Topo3DRenderer {
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private colorBuffer: GPUBuffer | null = null;
  private dimensions: { width: number; height: number } | null = null;
  private vertexCount: number = 0;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      // Get WebGPU adapter and device
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        throw new Error('No WebGPU adapter found');
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext('webgpu');

      if (!this.context) {
        throw new Error('Could not get WebGPU context');
      }

      // Configure the swap chain
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      });

      // Create the render pipeline
      this.pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: this.device.createShaderModule({
            code: `
                struct VertexOutput {
                  @builtin(position) position: vec4f,
                  @location(0) color: vec3f,
                }
  
                @vertex
                fn main(
                  @location(0) position: vec2f,
                  @location(1) color: vec3f
                ) -> VertexOutput {
                  var output: VertexOutput;
                  output.position = vec4f(position, 0.0, 1.0);
                  output.color = color;
                  return output;
                }
              `,
          }),
          entryPoint: 'main',
          buffers: [
            {
              // Position (x,y)
              arrayStride: 8,
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x2',
                },
              ],
            },
            {
              // Color (r,g,b)
              arrayStride: 12,
              attributes: [
                {
                  shaderLocation: 1,
                  offset: 0,
                  format: 'float32x3',
                },
              ],
            },
          ],
        },
        fragment: {
          module: this.device.createShaderModule({
            code: `
                @fragment
                fn main(@location(0) color: vec3f) -> @location(0) vec4f {
                  return vec4f(color, 1.0);
                }
              `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format: canvasFormat,
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  setupGeometry(data: ProcessedElevationData) {
    if (!this.device) return;

    this.dimensions = data.dimensions;
    const width = this.dimensions.width;
    const height = this.dimensions.height;

    // Create vertices for the grid
    const vertices: number[] = [];
    const colors: number[] = []; // Create colors array to match vertices

    // Calculate how many vertices we'll need
    // Each quad needs 6 vertices (2 triangles)
    this.vertexCount = 6 * (width - 1) * (height - 1);

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        // Convert grid coordinates to clip space (-1 to 1)
        const x1 = (x / (width - 1)) * 2 - 1;
        const x2 = ((x + 1) / (width - 1)) * 2 - 1;
        const y1 = (y / (height - 1)) * 2 - 1;
        const y2 = ((y + 1) / (height - 1)) * 2 - 1;

        // Get colors for each vertex
        const colorTopLeft = getColorForElevation(
          data.normalizedElevations[y * width + x]
        );
        const colorTopRight = getColorForElevation(
          data.normalizedElevations[y * width + (x + 1)]
        );
        const colorBottomLeft = getColorForElevation(
          data.normalizedElevations[(y + 1) * width + x]
        );
        const colorBottomRight = getColorForElevation(
          data.normalizedElevations[(y + 1) * width + (x + 1)]
        );

        // First triangle
        // Top-left
        vertices.push(x1, y1);
        colors.push(colorTopLeft.r, colorTopLeft.g, colorTopLeft.b);

        // Top-right
        vertices.push(x2, y1);
        colors.push(colorTopRight.r, colorTopRight.g, colorTopRight.b);

        // Bottom-left
        vertices.push(x1, y2);
        colors.push(colorBottomLeft.r, colorBottomLeft.g, colorBottomLeft.b);

        // Second triangle
        // Top-right
        vertices.push(x2, y1);
        colors.push(colorTopRight.r, colorTopRight.g, colorTopRight.b);

        // Bottom-right
        vertices.push(x2, y2);
        colors.push(colorBottomRight.r, colorBottomRight.g, colorBottomRight.b);

        // Bottom-left
        vertices.push(x1, y2);
        colors.push(colorBottomLeft.r, colorBottomLeft.g, colorBottomLeft.b);
      }
    }

    // Create and populate the vertex buffer
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.length * 4, // 4 bytes per float
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    // Create and populate the color buffer with the correct size
    this.colorBuffer = this.device.createBuffer({
      size: colors.length * 4, // 4 bytes per float
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(colors);
    this.colorBuffer.unmap();
  }

  render() {
    if (
      !this.device ||
      !this.context ||
      !this.pipeline ||
      !this.vertexBuffer ||
      !this.colorBuffer ||
      !this.dimensions
    ) {
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.colorBuffer);
    renderPass.draw(this.vertexCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
