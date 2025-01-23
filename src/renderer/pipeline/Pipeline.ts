export class PipelineBuilder {
  private device: GPUDevice;
  private pipelineLayout: GPUPipelineLayout | null = null;
  private vertexShader: GPUShaderModule | null = null;
  private fragmentShader: GPUShaderModule | null = null;
  private canvasFormat: GPUTextureFormat;

  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    this.device = device;
    this.canvasFormat = canvasFormat;
  }

  setPipelineLayout(bindGroupLayout: GPUBindGroupLayout): this {
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });
    return this;
  }

  setVertexShader(code: string): this {
    this.vertexShader = this.device.createShaderModule({ code });
    return this;
  }

  setFragmentShader(code: string): this {
    this.fragmentShader = this.device.createShaderModule({ code });
    return this;
  }

  build(): GPURenderPipeline {
    if (!this.pipelineLayout || !this.vertexShader || !this.fragmentShader) {
      throw new Error('PipelineBuilder is missing required components.');
    }

    return this.device.createRenderPipeline({
      layout: this.pipelineLayout,
      vertex: {
        module: this.vertexShader,
        entryPoint: 'main',
        buffers: [
          {
            // Vertex positions
            arrayStride: 12, // 3 floats * 4 bytes
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3',
              },
            ],
          },
          {
            // Colors
            arrayStride: 12, // 3 floats * 4 bytes
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: 'float32x3',
              },
            ],
          },
          {
            // Normals
            arrayStride: 12, // 3 floats * 4 bytes
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: 'float32x3',
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.fragmentShader,
        entryPoint: 'main',
        targets: [{ format: this.canvasFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });
  }
}
