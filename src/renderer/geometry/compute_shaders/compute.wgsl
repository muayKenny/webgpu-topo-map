@group(0) @binding(0) var<storage, read_write> vertexBuffer: array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> normalBuffer: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> colorBuffer: array<vec3<f32>>;
@group(0) @binding(3) var elevationTexture: texture_2d<f32>;

@compute @workgroup_size(8, 8) // Each workgroup handles an 8x8 block
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;

    let elevation = textureLoad(elevationTexture, vec2<i32>(x, y), 0).r;

    let vertexPosition = vec3<f32>(f32(x), f32(y), elevation);
    vertexBuffer[x + y * WIDTH] = vertexPosition;

    // Compute normal using finite differences...
    let normal = computeNormal(x, y);
    normalBuffer[x + y * WIDTH] = normal;

    // Assign color based on elevation...
    let color = getColorForElevation(elevation);
    colorBuffer[x + y * WIDTH] = color;
}