// Level Blueprint class for defining level structure and content

export default class LevelBlueprint {
  constructor(id, name, config = {}) {
    this.id = id;
    this.name = name;
    this.segmentCount = config.segmentCount || 15;
    this.segments = []; // Will hold segment definitions
    this.enemySpawns = []; // Predefined enemy spawn points
    this.powerupSpawns = []; // Predefined power-up spawn points
    this.difficulty = config.difficulty || 1;
    this.endSegment = config.hasEndSegment || false; // Whether this level has an ending
  }

  addSegment(segmentDef) {
    this.segments.push(segmentDef);
    return this;
  }

  addEnemySpawn(position, enemyType) {
    this.enemySpawns.push({ position, enemyType });
    return this;
  }

  addPowerupSpawn(position, powerupType) {
    this.powerupSpawns.push({ position, powerupType });
    return this;
  }
}
