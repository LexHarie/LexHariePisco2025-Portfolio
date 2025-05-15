export interface Poolable {
  reset(): void;
  update(deltaTime: number): void;
  isActive(): boolean;
  activate(): void;
  deactivate(): void;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number, maxSize: number) {
    this.factory = factory;
    this.maxSize = maxSize;
    
    // Pre-populate the pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createObject());
    }
  }

  private createObject(): T {
    const obj = this.factory();
    obj.deactivate();
    return obj;
  }

  public get(): T {
    // Find an inactive object
    const inactiveObj = this.pool.find(obj => !obj.isActive());
    
    if (inactiveObj) {
      inactiveObj.activate();
      return inactiveObj;
    }
    
    // If no inactive objects and we haven't reached max size, create a new one
    if (this.pool.length < this.maxSize) {
      const newObj = this.createObject();
      this.pool.push(newObj);
      newObj.activate();
      return newObj;
    }
    
    // If we've reached max size, recycle the oldest object
    const oldestObj = this.pool[0];
    oldestObj.reset();
    oldestObj.activate();
    
    // Move to end of array (newest)
    this.pool.push(this.pool.shift()!);
    
    return oldestObj;
  }

  public update(deltaTime: number): void {
    for (const obj of this.pool) {
      if (obj.isActive()) {
        obj.update(deltaTime);
      }
    }
  }

  public getActiveCount(): number {
    return this.pool.filter(obj => obj.isActive()).length;
  }

  public getTotalCount(): number {
    return this.pool.length;
  }

  public releaseAll(): void {
    for (const obj of this.pool) {
      obj.deactivate();
    }
  }
}