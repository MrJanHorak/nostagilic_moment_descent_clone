// Collision detection utilities
import * as THREE from 'three';

/**
 * Check collision between player and obstacles
 * @param {THREE.Camera} camera - The player's camera
 * @param {Array} obstacles - Array of obstacle objects
 * @param {THREE.Vector3} moveDirection - The direction the player is moving
 * @param {Number} tunnelWidth - Width of the tunnel
 * @param {Number} tunnelHeight - Height of the tunnel
 * @returns {Boolean} - Whether a collision would occur
 */
export function checkPlayerObstacleCollision(
  camera,
  obstacles,
  moveDirection,
  tunnelWidth,
  tunnelHeight
) {
  // Create a bounding sphere around the player for collision
  const playerPosition = new THREE.Vector3();
  camera.getWorldPosition(playerPosition);

  const playerRadius = 0.5; // Player collision radius
  const playerCollider = new THREE.Sphere(playerPosition, playerRadius);

  // Clone the position to check where the player would be after movement
  const nextPosition = playerPosition.clone().add(moveDirection);
  const nextCollider = new THREE.Sphere(nextPosition, playerRadius);

  // Check collision with each obstacle
  for (const obstacle of obstacles) {
    if (
      !obstacle.mesh ||
      !obstacle.mesh.userData ||
      !obstacle.mesh.userData.isObstacle
    )
      continue;

    // Create or update bounding box for obstacle if it doesn't exist
    if (!obstacle.mesh.userData.boundingBox) {
      obstacle.mesh.userData.boundingBox = new THREE.Box3().setFromObject(
        obstacle.mesh
      );
    } else {
      // Update the bounding box with current world transform
      obstacle.mesh.updateMatrixWorld(true);
      obstacle.mesh.userData.boundingBox.setFromObject(obstacle.mesh);
    }

    // Check if player sphere intersects with obstacle box
    if (
      checkSphereBoxIntersection(
        nextCollider,
        obstacle.mesh.userData.boundingBox
      )
    ) {
      return true; // Collision detected
    }
  }

  // Check tunnel bounds (prevent going through walls)
  if (
    Math.abs(nextPosition.x) > tunnelWidth / 2 - playerRadius ||
    Math.abs(nextPosition.y) > tunnelHeight / 2 - playerRadius
  ) {
    return true;
  }

  return false; // No collision
}

/**
 * Helper function to check if a sphere intersects with a box
 * @param {THREE.Sphere} sphere - The sphere to check
 * @param {THREE.Box3} box - The box to check against
 * @returns {Boolean} - Whether they intersect
 */
function checkSphereBoxIntersection(sphere, box) {
  // Find the closest point on the box to the sphere center
  const closestPoint = new THREE.Vector3();
  closestPoint.copy(sphere.center);

  // Clamp to box bounds
  closestPoint.x = Math.max(box.min.x, Math.min(box.max.x, closestPoint.x));
  closestPoint.y = Math.max(box.min.y, Math.min(box.max.y, closestPoint.y));
  closestPoint.z = Math.max(box.min.z, Math.min(box.max.z, closestPoint.z));

  // Check if the closest point is within the sphere radius
  const distance = sphere.center.distanceTo(closestPoint);
  return distance < sphere.radius;
}

/**
 * Check for precise projectile-enemy collision
 * @param {Object} projectile - Projectile object with mesh
 * @param {Object} enemy - Enemy object with mesh and collider
 * @returns {Boolean} - Whether there is a collision
 */
export function checkProjectileEnemyCollision(projectile, enemy) {
  // Get world position of projectile
  const projectilePosition = new THREE.Vector3();
  projectile.mesh.getWorldPosition(projectilePosition);

  // Create a small sphere around the projectile
  const projectileRadius = 0.1;
  const projectileSphere = new THREE.Sphere(
    projectilePosition,
    projectileRadius
  );

  // Make sure enemy collider is updated
  if (!enemy.collider) {
    enemy.collider = new THREE.Box3().setFromObject(enemy.mesh);
  } else {
    enemy.mesh.updateMatrixWorld(true);
    enemy.collider.setFromObject(enemy.mesh);
  }

  // Check if projectile sphere intersects with enemy bounding box
  if (enemy.collider.intersectsSphere(projectileSphere)) {
    return true;
  }

  return false;
}
