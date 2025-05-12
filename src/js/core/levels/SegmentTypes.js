// Defines the types of segments and obstacle patterns for level creation

export const SegmentType = {
  STRAIGHT: 'straight',
  CURVE_LEFT: 'curveLeft',
  CURVE_RIGHT: 'curveRight',
  JUNCTION: 'junction',
  BOSS_ROOM: 'bossRoom',
  END: 'end',
};

export const ObstaclePattern = {
  NONE: 'none',
  RANDOM: 'random',
  CENTER_BLOCK: 'centerBlock',
  SIDE_BLOCKS: 'sideBlocks',
  NARROW_PATH: 'narrowPath',
  CUSTOM: 'custom',
};
