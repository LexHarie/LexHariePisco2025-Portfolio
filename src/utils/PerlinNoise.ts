export class PerlinNoise {
  private perm: Uint8Array;
  private gradP: Array<number[]>;
  
  constructor(seed = Math.random()) {
    this.perm = new Uint8Array(512);
    this.gradP = new Array(512);
    this.seed(seed);
  }

  private seed(seed: number): void {
    if (seed > 0 && seed < 1) {
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if (seed < 256) {
      seed |= seed << 8;
    }

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? ((seed * i) & 255) : ((seed >> 8) * i) & 255;
      p[i] = v;
    }

    for (let i = 0; i < 256; i++) {
      this.perm[i] = this.perm[i + 256] = p[i];
    }

    for (let i = 0; i < 512; i++) {
      this.gradP[i] = this.grad3[this.perm[i] % 12];
    }
  }

  private grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return (1 - t) * a + t * b;
  }

  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const n00 = this.gradP[(X + this.perm[Y]) & 511][0] * x + this.gradP[(X + this.perm[Y]) & 511][1] * y;
    const n01 = this.gradP[(X + this.perm[Y + 1]) & 511][0] * x + this.gradP[(X + this.perm[Y + 1]) & 511][1] * (y - 1);
    const n10 = this.gradP[(X + 1 + this.perm[Y]) & 511][0] * (x - 1) + this.gradP[(X + 1 + this.perm[Y]) & 511][1] * y;
    const n11 = this.gradP[(X + 1 + this.perm[Y + 1]) & 511][0] * (x - 1) + this.gradP[(X + 1 + this.perm[Y + 1]) & 511][1] * (y - 1);

    return this.lerp(
      this.lerp(n00, n10, u),
      this.lerp(n01, n11, u),
      v
    );
  }

  public noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = (this.perm[X] + Y) & 255;
    const B = (this.perm[X + 1] + Y) & 255;
    
    const AA = (this.perm[A] + Z) & 255;
    const AB = (this.perm[A + 1] + Z) & 255;
    const BA = (this.perm[B] + Z) & 255;
    const BB = (this.perm[B + 1] + Z) & 255;

    const g000 = this.gradP[this.perm[AA]];
    const g001 = this.gradP[this.perm[AB]];
    const g010 = this.gradP[this.perm[this.perm[A + 1] + Z]];
    const g011 = this.gradP[this.perm[this.perm[A + 1] + Z + 1]];
    const g100 = this.gradP[this.perm[BA]];
    const g101 = this.gradP[this.perm[BB]];
    const g110 = this.gradP[this.perm[this.perm[B + 1] + Z]];
    const g111 = this.gradP[this.perm[this.perm[B + 1] + Z + 1]];

    const n000 = g000[0] * x + g000[1] * y + g000[2] * z;
    const n001 = g001[0] * x + g001[1] * y + g001[2] * (z - 1);
    const n010 = g010[0] * x + g010[1] * (y - 1) + g010[2] * z;
    const n011 = g011[0] * x + g011[1] * (y - 1) + g011[2] * (z - 1);
    const n100 = g100[0] * (x - 1) + g100[1] * y + g100[2] * z;
    const n101 = g101[0] * (x - 1) + g101[1] * y + g101[2] * (z - 1);
    const n110 = g110[0] * (x - 1) + g110[1] * (y - 1) + g110[2] * z;
    const n111 = g111[0] * (x - 1) + g111[1] * (y - 1) + g111[2] * (z - 1);

    return this.lerp(
      this.lerp(
        this.lerp(n000, n100, u),
        this.lerp(n010, n110, u),
        v
      ),
      this.lerp(
        this.lerp(n001, n101, u),
        this.lerp(n011, n111, u),
        v
      ),
      w
    );
  }

  public fbm(x: number, y: number, octaves = 6, lacunarity = 2, persistence = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    return total / maxValue;
  }
}