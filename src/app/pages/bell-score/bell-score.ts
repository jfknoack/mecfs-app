import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Auth } from '../../core/auth/auth';
import {
  BELL_SCORE_LEVELS,
  BELL_SCORE_REFERENCE,
  BellScore,
  bellScoreLevel,
  suggestedBudgetFromBell,
} from '../../core/pacing/bell-score.model';
import { PacingPermissionError, PacingService } from '../../core/pacing/pacing.service';

@Component({
  imports: [MatButtonModule, MatSnackBarModule],
  selector: 'app-bell-score',
  styleUrl: './bell-score.scss',
  templateUrl: './bell-score.html',
})
export class BellScorePage {
  private readonly auth = inject(Auth);
  private readonly pacing = inject(PacingService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly title = 'Bell-Score';
  protected readonly levels = BELL_SCORE_LEVELS;
  protected readonly reference = BELL_SCORE_REFERENCE;
  protected readonly canEdit = this.auth.canEditBellScore;
  protected readonly settingsReady = this.pacing.settingsReady;
  protected readonly selected = this.pacing.bellScore;
  protected readonly saving = signal(false);

  protected readonly selectedLevel = computed(() => bellScoreLevel(this.selected()));
  protected readonly suggestedBudget = computed(() => suggestedBudgetFromBell(this.selected()));

  protected async choose(score: BellScore): Promise<void> {
    if (!this.canEdit()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.pacing.saveBellScore(score);
      this.snackBar.open(`Bell-Score ${score} gespeichert.`, 'OK', { duration: 2500 });
    } catch (error) {
      const message =
        error instanceof PacingPermissionError
          ? error.message
          : 'Bell-Score konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
