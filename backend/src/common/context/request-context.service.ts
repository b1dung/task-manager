import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  requestId: string;
  userId: string | null;
  ipAddress: string | null;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  get userId(): string | null {
    return this.storage.getStore()?.userId ?? null;
  }

  get requestId(): string | null {
    return this.storage.getStore()?.requestId ?? null;
  }

  get ipAddress(): string | null {
    return this.storage.getStore()?.ipAddress ?? null;
  }
}
