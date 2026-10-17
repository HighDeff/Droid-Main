export class DeviceLocks {
  private locks = new Set<string>();

  has(device: string): boolean {
    return this.locks.has(device);
  }

  acquire(device: string): boolean {
    if (this.locks.has(device)) return false;
    this.locks.add(device);
    return true;
  }

  release(device: string): void {
    this.locks.delete(device);
  }
}

export const deviceLocks = new DeviceLocks();
