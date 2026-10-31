// Pure AABB collision helpers. No rendering code in here.
export function overlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

const _box = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

export class CollisionSystem {
  obstacleBox(o, out) {
    const u = o.userData, p = o.position;
    out.minX = p.x - u.halfW + 0.1; out.maxX = p.x + u.halfW - 0.1; // small forgiveness
    out.minY = u.minY; out.maxY = u.maxY - 0.05;
    out.minZ = p.z - u.halfD; out.maxZ = p.z + u.halfD;
    return out;
  }

  // Returns { obstacle, side } for the first hit, or null.
  // side = true when the player scraped along an obstacle while changing lanes.
  checkObstacles(pb, obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.position.z - o.userData.halfD > 4 || o.position.z + o.userData.halfD < -4) continue; // cheap reject
      const b = this.obstacleBox(o, _box);
      if (overlap(pb, b)) return { obstacle: o, side: b.maxZ > pb.maxZ + 0.35 };
    }
    return null;
  }
}