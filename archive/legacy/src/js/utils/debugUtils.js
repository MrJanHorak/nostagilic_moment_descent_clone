// Utilities for debugging and scene validation

import * as THREE from 'three';

// Override updateMatrixWorld to detect recursive calls
export function setupRecursiveDetection() {
  THREE.Object3D.prototype.updateMatrixWorld = (function (original) {
    return function () {
      if (this.__isUpdating) {
        console.error('Recursive updateMatrixWorld detected for object:', this);
        console.trace(); // Added console.trace() for more details
        return;
      }
      this.__isUpdating = true;
      original.apply(this, arguments);
      this.__isUpdating = false;
    };
  })(THREE.Object3D.prototype.updateMatrixWorld);
}

// Utility to validate geometries
export function validateGeometry(geometry) {
  if (!geometry || !(geometry instanceof THREE.BufferGeometry)) {
    console.error('Invalid geometry detected:', geometry);
    return false;
  }

  // Check if the geometry has valid attributes
  if (!geometry.attributes.position) {
    console.error('Geometry missing position attribute:', geometry);
    return false;
  }

  // Check if the bounding sphere can be computed
  try {
    geometry.computeBoundingSphere();
  } catch (error) {
    console.error(
      'Error computing bounding sphere for geometry:',
      geometry,
      error
    );
    return false;
  }

  return true;
}

// Enhanced circular reference detection with full path tracking
export function detectCircularReferences(root) {
  const visited = new WeakMap();
  let hasCircular = false;
  let circularPath = [];

  function traverse(obj, path = []) {
    // Skip non-Object3D objects
    if (!obj || !(obj instanceof THREE.Object3D)) return;

    // Record object info for the current path
    const objInfo = {
      id: obj.id,
      uuid: obj.uuid,
      type: obj.type || obj.constructor.name,
      name: obj.name || '(unnamed)',
    };

    const currentPath = [...path, objInfo];

    if (visited.has(obj)) {
      // We found a circular reference
      hasCircular = true;
      circularPath = currentPath;

      // Find where in the path the object appears again
      const firstIndex = path.findIndex((item) => item.uuid === obj.uuid);
      if (firstIndex !== -1) {
        const cycle = path.slice(firstIndex).concat([objInfo]);
        console.error('CIRCULAR REFERENCE DETECTED!');
        console.error(
          'Cycle:',
          cycle.map((o) => `${o.type}[${o.name}]`).join(' -> ')
        );
      }
      return;
    }

    // Mark as visited
    visited.set(obj, currentPath);

    // Check its children
    if (obj.children && obj.children.length > 0) {
      for (const child of obj.children) {
        // Skip if we already found a circular reference
        if (hasCircular) return;
        traverse(child, currentPath);
      }
    }
  }

  traverse(root);

  if (hasCircular) {
    // Log formatted path information
    console.error('CIRCULAR REFERENCE FOUND! Complete path:');
    console.table(
      circularPath.map((info) => ({
        ID: info.id,
        UUID: info.uuid.substring(0, 8) + '...',
        Type: info.type,
        Name: info.name,
      }))
    );

    return true;
  }
  return false;
}

// Validate scene geometries to identify potential issues
export function validateSceneGeometries(scene) {
  const geometryCount = new Map();
  const materialCount = new Map();

  console.log('Validating scene graph integrity...');

  scene.traverse((obj) => {
    // Count instances of each geometry and material
    if (obj.geometry) {
      const geoKey = obj.geometry.uuid;
      geometryCount.set(geoKey, (geometryCount.get(geoKey) || 0) + 1);
    }

    if (obj.material) {
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      materials.forEach((mat) => {
        if (mat) {
          const matKey = mat.uuid;
          materialCount.set(matKey, (materialCount.get(matKey) || 0) + 1);
        }
      });
    }

    // Check for invalid matrix data
    if (obj.matrix) {
      const elements = obj.matrix.elements;
      const hasNaN = elements.some((e) => isNaN(e));
      const hasInfinity = elements.some((e) => !isFinite(e));

      if (hasNaN || hasInfinity) {
        console.error('Invalid matrix found in object:', obj);
        console.error('Matrix elements:', elements);
      }
    }
  });

  // Report geometry and material instances
  console.log(`Scene contains ${geometryCount.size} unique geometries`);
  console.log(`Scene contains ${materialCount.size} unique materials`);

  // Check for high instance counts (potential memory problems)
  let highInstancesFound = false;
  geometryCount.forEach((count, uuid) => {
    if (count > 100) {
      highInstancesFound = true;
      console.warn(`Geometry used ${count} times (${uuid})`);
    }
  });

  if (!highInstancesFound) {
    console.log('No abnormal geometry usage detected');
  }

  return {
    geometryCount: geometryCount.size,
    materialCount: materialCount.size,
  };
}

// Setup protection against circular references in scene graph
export function setupSceneProtection(scene, camera) {
  const originalAdd = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (...objects) {
    for (const obj of objects) {
      // Prevent adding scene as a child of anything
      if (typeof scene !== 'undefined' && obj === scene) {
        console.error('Attempted to add scene as a child of', this);
        return this;
      }
      // Prevent adding camera as a child of anything except scene
      if (typeof camera !== 'undefined' && obj === camera && this !== scene) {
        console.error(
          'Attempted to add camera as a child of',
          this,
          'which is not the scene'
        );
        return this;
      }
      // Prevent adding an ancestor as a child (circular reference)
      let ancestor = this;
      while (ancestor) {
        if (ancestor === obj) {
          console.error(
            'Attempted to create a circular reference by adding',
            obj,
            'as a child of',
            this
          );
          return this;
        }
        ancestor = ancestor.parent;
      }
    }
    return originalAdd.apply(this, objects);
  };
}
