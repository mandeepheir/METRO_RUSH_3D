// Shared tuning numbers. Change values here to rebalance the game.
export const LANE_WIDTH = 2.6;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
export const TRACK_HALF = LANE_WIDTH * 1.5 + 0.5;

export const START_SPEED = 15;
export const MAX_SPEED = 36;
export const SPEED_RAMP = 0.26; // units/sec gained per second

export const GRAVITY = 38;
export const JUMP_VELOCITY = 13;
export const SLIDE_TIME = 0.8;
export const STAND_HEIGHT = 2.0;
export const SLIDE_HEIGHT = 0.85;
export const JETPACK_HEIGHT = 5.4;

export const SPAWN_Z = -140;
export const DESPAWN_Z = 16;
export const MOVING_TRAIN_FACTOR = 0.4; // extra speed of moving trains

export const MAGNET_RADIUS = 8;
export const POWERUP_DURATION = { magnet: 10, multiplier: 12, jetpack: 7, shield: 20 };
export const POWERUP_INFO = {
  magnet: { icon: '🧲', label: 'MAGNET', color: '#ff4d6d' },
  multiplier: { icon: '✖2', label: '2X SCORE', color: '#ffd23f' },
  jetpack: { icon: '🚀', label: 'JETPACK', color: '#ff8a1f' },
  shield: { icon: '🛡', label: 'SHIELD', color: '#3dd9ff' },
};

export const CHARACTERS = [
  { id: 'volt', name: 'VOLT', cost: 0, suit: 0x00b8d9, accent: 0xff2bd6, skin: 0xffc8a0, hair: 0x22224a },
  { id: 'blaze', name: 'BLAZE', cost: 300, suit: 0xff5a1f, accent: 0xffd400, skin: 0xd89870, hair: 0x3a1a0a },
  { id: 'nova', name: 'NOVA', cost: 800, suit: 0x9b4dff, accent: 0x39ffb0, skin: 0xf2c6a8, hair: 0xeeeeff },
  { id: 'shadow', name: 'SHADOW', cost: 1800, suit: 0x23283a, accent: 0xff2d55, skin: 0x8d5a3c, hair: 0x050505 },
  { id: 'aurora', name: 'AURORA', cost: 3500, suit: 0x2dff9a, accent: 0xffffff, skin: 0xf5d0b5, hair: 0xff79c6 },
];

export const LEVEL_XP = (level) => 200 + level * 100;
export const LEVEL_REWARD = (level) => 50 + level * 25;