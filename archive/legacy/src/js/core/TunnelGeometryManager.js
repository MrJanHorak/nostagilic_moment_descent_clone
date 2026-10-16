// TunnelGeometryManager.js
// Handles geometry creation and caching for tunnel segments
import * as THREE from 'three';

class TunnelGeometryManager {
  constructor(tunnelWidth, tunnelHeight, segmentLength) {
    this.tunnelWidth = tunnelWidth;
    this.tunnelHeight = tunnelHeight;
    this.segmentLength = segmentLength;
    // Cache common geometries
    this.planeGeometry = new THREE.PlaneGeometry(tunnelWidth, tunnelHeight);
    this.wallGeometry = new THREE.PlaneGeometry(segmentLength, tunnelHeight);
  }

  // Create straight tunnel segment geometries
  getStraightGeometries(width, height, length) {
    return {
      floor: new THREE.PlaneGeometry(width, height),
      ceiling: new THREE.PlaneGeometry(width, height),
      leftWall: new THREE.PlaneGeometry(length, height),
      rightWall: new THREE.PlaneGeometry(length, height),
      endWall: new THREE.PlaneGeometry(width, height),
    };
  }

  // Create curved wall geometry (utility for LevelManager)
  createCurvedWallGeometry(
    width,
    height,
    length,
    curveAmount,
    curveAngle,
    wallSegments
  ) {
    // ...copy logic from applyCurveToSegment for wall geometry...
    // This is a utility function, to be filled in during integration
    // Returns { leftWallGeom, rightWallGeom, endWallGeom }
  }
}

export default TunnelGeometryManager;
