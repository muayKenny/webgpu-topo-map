use wasm_bindgen::prelude::*;
use js_sys::Float32Array;


#[wasm_bindgen]
pub struct MeshComputeData {
    vertices: Vec<f32>,
    colors: Vec<f32>,
    normals: Vec<f32>,
    vertex_count: usize, 
}

#[wasm_bindgen]
impl MeshComputeData {
    #[wasm_bindgen(getter)]
    pub fn vertices(&self) -> js_sys::Float32Array {
        Float32Array::from(self.vertices.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn colors(&self) -> js_sys::Float32Array {
        Float32Array::from(self.colors.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn normals(&self) -> js_sys::Float32Array {
        Float32Array::from(self.normals.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> usize {
        self.vertex_count
    }
}

fn interpolate_elevations(
    elevations: &[f32],
    original_width: usize,
    original_height: usize,
    new_width: usize,
    new_height: usize
) -> Vec<f32> {
    let mut interpolated = vec![0.0; new_width * new_height];

    for y in 0..new_height {
        for x in 0..new_width {
            let orig_x = (x as f32 * (original_width as f32 - 1.0)) / (new_width as f32 - 1.0);
            let orig_y = (y as f32 * (original_height as f32 - 1.0)) / (new_height as f32 - 1.0);

            let x1 = orig_x.floor() as usize;
            let x2 = (x1 + 1).min(original_width - 1);
            let y1 = orig_y.floor() as usize;
            let y2 = (y1 + 1).min(original_height - 1);

            let dx = orig_x - x1 as f32;
            let dy = orig_y - y1 as f32;

            let z1 = elevations[y1 * original_width + x1];
            let z2 = elevations[y1 * original_width + x2];
            let z3 = elevations[y2 * original_width + x1];
            let z4 = elevations[y2 * original_width + x2];

            interpolated[y * new_width + x] =
                z1 * (1.0 - dx) * (1.0 - dy) +
                z2 * dx * (1.0 - dy) +
                z3 * (1.0 - dx) * dy +
                z4 * dx * dy;
        }
    }

    interpolated
}

fn calculate_normal(v1: (f32, f32, f32), v2: (f32, f32, f32), v3: (f32, f32, f32)) -> (f32, f32, f32) {
    let edge1 = (v2.0 - v1.0, v2.1 - v1.1, v2.2 - v1.2);
    let edge2 = (v3.0 - v1.0, v3.1 - v1.1, v3.2 - v1.2);

    // Cross product
    let normal = (
        edge1.1 * edge2.2 - edge1.2 * edge2.1,
        edge1.2 * edge2.0 - edge1.0 * edge2.2,
        edge1.0 * edge2.1 - edge1.1 * edge2.0,
    );

    // Normalize
    let length = (normal.0 * normal.0 + normal.1 * normal.1 + normal.2 * normal.2).sqrt();
    if length == 0.0 {
        return (0.0, 0.0, 0.0);
    }

    (normal.0 / length, normal.1 / length, normal.2 / length)
}

#[derive(Copy, Clone)]
struct RGB {
    r: f32,
    g: f32,
    b: f32
}

const TERRAIN_COLORS: [(f32, RGB); 7] = [
    (0.0, RGB { r: 0.6, g: 0.6, b: 0.95 }), // Light blue for lowest areas
    (0.1, RGB { r: 0.4, g: 0.8, b: 0.4 }),  // Light green for low lands
    (0.3, RGB { r: 0.2, g: 0.6, b: 0.2 }),  // Darker green
    (0.5, RGB { r: 0.8, g: 0.7, b: 0.5 }),  // Light brown
    (0.7, RGB { r: 0.7, g: 0.55, b: 0.4 }), // Medium brown
    (0.9, RGB { r: 0.75, g: 0.75, b: 0.75 }), // Gray
    (1.0, RGB { r: 1.0, g: 1.0, b: 1.0 }),  // White for peaks!
];

fn get_color_for_elevation(normalized_elevation: f32) -> RGB {
    for i in 0..TERRAIN_COLORS.len() - 1 {
        let (stop1, ref color1) = TERRAIN_COLORS[i];
        let (stop2, ref color2) = TERRAIN_COLORS[i + 1];

        if normalized_elevation >= stop1 && normalized_elevation <= stop2 {
            let terped_color = (normalized_elevation - stop1) / (stop2 - stop1);
           

             return RGB {  
                r: color1.r + (color2.r - color1.r) * terped_color,
                g: color1.g + (color2.g - color1.g) * terped_color,
                b: color1.b + (color2.b - color1.b) * terped_color,
            };
        }
    }

    // If nothing matched, return the last color in the array
    return TERRAIN_COLORS[TERRAIN_COLORS.len() - 1].1;
}

#[wasm_bindgen]
pub fn mesh_compute(
    elevations: &[f32],
    width: usize,
    height: usize,
    tessellation_factor: usize
) -> MeshComputeData {
    let new_width = width * tessellation_factor;
    let new_height = height * tessellation_factor;

    let interpolated = interpolate_elevations(elevations, width, height, new_width, new_height);

    let mut vertices = Vec::new();
    let mut colors = Vec::new();
    let mut normals = Vec::new();

    for y in 0..new_height - 1 {
        for x in 0..new_width - 1 {
            let x1 = (x as f32 / (new_width - 1) as f32) * 2.0 - 1.0;
            let x2 = ((x + 1) as f32 / (new_width - 1) as f32) * 2.0 - 1.0;
            let y1 = (y as f32 / (new_height - 1) as f32) * 2.0 - 1.0;
            let y2 = ((y + 1) as f32 / (new_height - 1) as f32) * 2.0 - 1.0;

            let z1 = interpolated[y * new_width + x];
            let z2 = interpolated[y * new_width + (x + 1)];
            let z3 = interpolated[(y + 1) * new_width + x];
            let z4 = interpolated[(y + 1) * new_width + (x + 1)];

            let quad_vertices = [
                (x1, y1, z1),
                (x2, y1, z2),
                (x1, y2, z3),
                (x2, y2, z4),
            ];

            let triangle_indices = [[0, 1, 2], [1, 3, 2]];

            for indices in triangle_indices {
                let normal = calculate_normal(
                    quad_vertices[indices[0]],
                    quad_vertices[indices[1]],
                    quad_vertices[indices[2]],
                );

                for &i in &indices {
                    normals.extend_from_slice(&[normal.0, normal.1, normal.2]);
                    vertices.extend_from_slice(&[
                        quad_vertices[i].0,
                        quad_vertices[i].1,
                        quad_vertices[i].2,
                    ]);
                    let vertex_z = quad_vertices[i].2;
                    
                    let color: RGB = get_color_for_elevation(vertex_z);
                    colors.extend_from_slice(&[color.r, color.g, color.b]);
                }
            }
        }
    }
    
    let vertex_count = vertices.len() / 3;

    MeshComputeData {
        vertices,
        colors,
        normals,
        vertex_count,
    }
}