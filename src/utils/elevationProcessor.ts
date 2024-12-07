// src/utils/elevationProcessor.ts

import { ElevationData } from './loadElevation';

export interface ProcessedElevationData {
  normalizedElevations: Float32Array; // 0-1 range
  rawElevations: Float32Array; // original values
  dimensions: {
    width: number;
    height: number;
  };
  bounds: {
    elevation: {
      min: number;
      max: number;
    };
    geographic: {
      minLong: number;
      minLat: number;
      maxLong: number;
      maxLat: number;
    };
  };
}

export function processElevationData(
  data: ElevationData
): ProcessedElevationData {
  // Convert elevation array to Float32Array for GPU compatibility
  const rawElevations = new Float32Array(data.elevations);

  // Find elevation bounds
  const minElevation = Math.min(...rawElevations);
  const maxElevation = Math.max(...rawElevations);
  const elevationRange = maxElevation - minElevation;

  // Create normalized elevation array (0-1 range)
  const normalizedElevations = new Float32Array(
    rawElevations.map(
      (elevation) => (elevation - minElevation) / elevationRange
    )
  );

  return {
    normalizedElevations,
    rawElevations,
    dimensions: {
      width: data.width,
      height: data.height,
    },
    bounds: {
      elevation: {
        min: minElevation,
        max: maxElevation,
      },
      geographic: {
        minLong: data.metadata.bounds.minLong,
        minLat: data.metadata.bounds.minLat,
        maxLong: data.metadata.bounds.maxLong,
        maxLat: data.metadata.bounds.maxLat,
      },
    },
  };
}

// Utility function to get elevation at specific coordinates
export function getElevationAtPoint(
  processed: ProcessedElevationData,
  x: number,
  y: number
): number | null {
  if (
    x < 0 ||
    x >= processed.dimensions.width ||
    y < 0 ||
    y >= processed.dimensions.height
  ) {
    return null;
  }

  const index = y * processed.dimensions.width + x;
  return processed.rawElevations[index];
}

// Utility function to get normalized elevation at specific coordinates
export function getNormalizedElevationAtPoint(
  processed: ProcessedElevationData,
  x: number,
  y: number
): number | null {
  if (
    x < 0 ||
    x >= processed.dimensions.width ||
    y < 0 ||
    y >= processed.dimensions.height
  ) {
    return null;
  }

  const index = y * processed.dimensions.width + x;
  return processed.normalizedElevations[index];
}

// Convert geographic coordinates to pixel coordinates
export function geoToPixel(
  processed: ProcessedElevationData,
  longitude: number,
  latitude: number
): { x: number; y: number } | null {
  const { geographic } = processed.bounds;

  // Check if coordinates are within bounds
  if (
    longitude < geographic.minLong ||
    longitude > geographic.maxLong ||
    latitude < geographic.minLat ||
    latitude > geographic.maxLat
  ) {
    return null;
  }

  // Convert to pixel coordinates
  const x = Math.floor(
    ((longitude - geographic.minLong) /
      (geographic.maxLong - geographic.minLong)) *
      (processed.dimensions.width - 1)
  );

  const y = Math.floor(
    ((latitude - geographic.minLat) / (geographic.maxLat - geographic.minLat)) *
      (processed.dimensions.height - 1)
  );

  return { x, y };
}

// Convert pixel coordinates to geographic coordinates
export function pixelToGeo(
  processed: ProcessedElevationData,
  x: number,
  y: number
): { longitude: number; latitude: number } | null {
  if (
    x < 0 ||
    x >= processed.dimensions.width ||
    y < 0 ||
    y >= processed.dimensions.height
  ) {
    return null;
  }

  const { geographic } = processed.bounds;

  const longitude =
    geographic.minLong +
    (x / (processed.dimensions.width - 1)) *
      (geographic.maxLong - geographic.minLong);

  const latitude =
    geographic.minLat +
    (y / (processed.dimensions.height - 1)) *
      (geographic.maxLat - geographic.minLat);

  return { longitude, latitude };
}
