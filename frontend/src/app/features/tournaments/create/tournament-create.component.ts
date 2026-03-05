import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'sc-tournament-create',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSlideToggleModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page">
      <div class="page__header">
        <button mat-icon-button routerLink="/tournaments">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>New Tournament</h1>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Title *</mat-label>
          <input matInput formControlName="title" placeholder="e.g. SoundFest 2026">
          @if (form.get('title')?.errors?.['required'] && form.get('title')?.touched) {
            <mat-error>Title is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"
            placeholder="What's this tournament about?"></textarea>
        </mat-form-field>

        <div class="date-row">
          <mat-form-field appearance="outline">
            <mat-label>Start date</mat-label>
            <input matInput type="date" formControlName="start_date">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>End date</mat-label>
            <input matInput type="date" formControlName="end_date">
          </mat-form-field>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-label">Community voting</span>
            <span class="toggle-hint">Listeners can vote on each battle</span>
          </div>
          <mat-slide-toggle formControlName="voting_enabled" color="primary" />
        </div>

        @if (error()) { <p class="error">{{ error() }}</p> }

        <button mat-flat-button color="primary" type="submit" [disabled]="loading() || form.invalid">
          @if (loading()) { <mat-spinner diameter="20" /> } @else { Create Tournament }
        </button>
      </form>

      <div class="info-box">
        <mat-icon>info</mat-icon>
        <div>
          <strong>How it works</strong>
          <p>Once created, artists can join with their track. When you're ready, advance to Round 1 — the Swiss-system engine auto-pairs competitors by rank.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 16px; }
    .page__header {
      display: flex; align-items: center; gap: 4px; margin-bottom: 20px;
      h1 { margin: 0; font-size: 20px; font-weight: 700; }
    }
    .form { display: flex; flex-direction: column; gap: 14px; }
    mat-form-field { width: 100%; }
    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .toggle-row {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--color-bg-elevated); border-radius: var(--radius-card);
      padding: 14px 16px;
    }
    .toggle-label { display: block; font-weight: 600; font-size: 14px; }
    .toggle-hint  { display: block; font-size: 12px; color: var(--color-text-secondary); }
    .error { color: var(--color-accent-hot); font-size: 13px; margin: 0; }
    button[type=submit] { height: 48px; }
    .info-box {
      display: flex; gap: 12px; align-items: flex-start;
      background: var(--color-bg-elevated); border-radius: var(--radius-card);
      padding: 14px 16px; margin-top: 20px;
      mat-icon { color: var(--color-accent-primary); flex-shrink: 0; }
      strong { display: block; margin-bottom: 4px; }
      p { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
    }
  `],
})
export class TournamentCreateComponent {
  private fb     = inject(FormBuilder);
  private api    = inject(ApiService);
  private router = inject(Router);

  form = this.fb.group({
    title:          ['', Validators.required],
    description:    [''],
    start_date:     [''],
    end_date:       [''],
    voting_enabled: [true],
  });

  loading = signal(false);
  error   = signal('');

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const v = this.form.value;
    this.api.post<{ id: string }>('/tournaments/', {
      title:          v.title,
      description:    v.description || null,
      start_date:     v.start_date  || null,
      end_date:       v.end_date    || null,
      voting_enabled: v.voting_enabled,
    }).subscribe({
      next: t  => this.router.navigate(['/tournaments', t.id]),
      error: e => { this.error.set(e.error?.detail ?? 'Failed to create'); this.loading.set(false); },
    });
  }
}
