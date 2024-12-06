export class TopoRenderer {
  private canvas: HTMLCanvasElement;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported');
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('No appropriate GPUAdapter found');
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext('webgpu');

      if (!this.context) {
        throw new Error('Could not get WebGPU context');
      }

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
                            @vertex
                            fn main(@location(0) position: vec2f) -> @builtin(position) vec4f {
                                return vec4f(position, 0.0, 1.0);
                            }
                        `,
          }),
          entryPoint: 'main',
          buffers: [
            {
              arrayStride: 8, // 2 * float32
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x2',
                },
              ],
            },
          ],
        },
        fragment: {
          module: this.device.createShaderModule({
            code: `
                            @fragment
                            fn main() -> @location(0) vec4f {
                                return vec4f(1.0, 0.0, 0.0, 1.0);  // Red color
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

      // Create vertex buffer
      const vertices = new Float32Array([
        -0.5,
        -0.5, // Triangle 1
        0.5,
        -0.5,
        0.5,
        0.5,

        -0.5,
        -0.5, // Triangle 2
        0.5,
        0.5,
        -0.5,
        0.5,
      ]);

      this.vertexBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
      this.vertexBuffer.unmap();

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  render() {
    if (!this.device || !this.context || !this.pipeline || !this.vertexBuffer) {
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(6); // 6 vertices for 2 triangles
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
