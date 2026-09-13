export type PlatformId = "local" | "pikabu" | "vk" | "ok";
export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly capabilities: {
    cloudSave: boolean;
    ads: boolean;
    payments: boolean;
  };
  init(): Promise<void>;
  ready(): void;
  load(key: string): Promise<string | null>;
  save(key: string, value: string): Promise<void>;
  flush(key: string, value: string): void;
}
