// src/utils/loadElevation.ts
import { fromUrl, GeoTIFF } from 'geotiff';

export interface ElevationData {
  width: number;
  height: number;
  elevations: Float32Array;
  metadata: {
    bounds: {
      minLong: number;
      maxLong: number;
      minLat: number;
      maxLat: number;
    };
  };
}

export async function loadElevationData(path: string): Promise<ElevationData> {
  // Load the GeoTIFF
  const tiff: GeoTIFF = await fromUrl(path);
  const image = await tiff.getImage();

  // Get the metadata
  const bbox = image.getBoundingBox();
  const metadata = {
    bounds: {
      minLong: bbox[0],
      minLat: bbox[1],
      maxLong: bbox[2],
      maxLat: bbox[3],
    },
  };

  // Read the raster data
  const raster = await image.readRasters();
  const elevations = raster[0] as Float32Array;

  return {
    width: image.getWidth(),
    height: image.getHeight(),
    elevations,
    metadata,
  };
}
