import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly updates = inject(SwUpdate, { optional: true });
  readonly updateReady = signal(false);

  constructor() {
    const updates = this.updates;
    if (!updates?.isEnabled) {
      return;
    }

    updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));

    updates.unrecoverable.subscribe(() => document.location.reload());
  }

  activate(): void {
    void this.updates?.activateUpdate().then(() => document.location.reload());
  }
}
