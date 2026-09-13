import type { PlatformAdapter, PlatformId } from "../types";
export class LocalAdapter implements PlatformAdapter {
  readonly capabilities = { cloudSave: false, ads: false, payments: false };
  constructor(readonly id: PlatformId = "local") {}
  async init() {}
  ready() {}
  async load(key: string) {
    return localStorage.getItem(`${this.id}:${key}`);
  }
  async save(key: string, value: string) {
    this.flush(key, value);
  }
  flush(key: string, value: string) {
    localStorage.setItem(`${this.id}:${key}`, value);
  }
}
