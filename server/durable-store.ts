import fs from "fs";
import path from "path";

export interface StorageOptions {
  storageDir?: string;
  inMemory?: boolean;
  mode?: "memory" | "disk" | string;
}

export class DurableStore {
  private inMemory: boolean;
  private storageDir: string;
  private memoryStore: Map<string, any[]> = new Map();

  constructor(options: StorageOptions = {}) {
    this.inMemory = options.inMemory ?? (options.mode === "memory");
    this.storageDir = options.storageDir ?? path.join(process.cwd(), ".data");
    if (!this.inMemory && !fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true });
      } catch {
        this.inMemory = true;
      }
    }
  }

  readCollection<T>(name: string): T[] {
    if (this.inMemory) {
      return (this.memoryStore.get(name) as T[]) || [];
    }
    const filePath = path.join(this.storageDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T[];
    } catch {
      return [];
    }
  }

  writeCollection<T>(name: string, items: T[]): void {
    if (this.inMemory) {
      this.memoryStore.set(name, items);
      return;
    }
    const filePath = path.join(this.storageDir, `${name}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf-8");
    } catch {
      this.memoryStore.set(name, items);
    }
  }
}
