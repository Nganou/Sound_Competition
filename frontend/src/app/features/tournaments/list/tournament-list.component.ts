import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

interface Tournament {
  id: string; title: string; description: string | null;
  status: 'open' | 'active' | 'completed'; voting_enabled: boolean;
  current_round: number; total_rounds: number | null; participant_count: number;
  start_date: string | null; end_date: string | null;
  organizer: { username: string; display_name: string | null }; created_at: string;
}

@Component({
  selector: 'sc-tournament-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="page">
      <div class="page__header">
        <h1>⚔ Tournaments</h1>
        <a mat-flat-button color="primary" routerLink="/tournaments/new">
          <mat-icon>add</mat-icon> New
        </a>
      </div>

      <div class="filter-tabs">
        @for (f of filters; track f.value) {
          <button class="sc-chip" [class.active]="activeFilter() === f.value" (click)="setFilter(f.value)">
            {{ f.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="center"><mat-spinner diameter="40" /></div>
      } @else {
        <div class="list">
          @for (t of tournaments(); track t.id) {
            <a [routerLink]="['/tournaments', t.id]" class="t-card sc-card">
              <div class="t-card__top">
                <span class="status-badge" [class]="'status-' + t.status">{{ statusLabel(t.status) }}</span>
                @if (t.voting_enabled) { <span class="vote-chip">🗳 Community vote</span> }
              </div>
              <h2 class="t-card__title">{{ t.title }}</h2>
              @if (t.description) { <p class="t-card__desc">{{ t.description }}</p> }
              <div class="t-card__meta">
                <span><mat-icon>people</mat-icon> {{ t.participant_count }} artists</span>
                @if (t.status === 'active') { <span><mat-icon>flag</mat-icon> Round {{ t.current_round }}</span> }
                @if (t.start_date) { <span><mat-icon>calendar_today</mat-icon> {{ t.start_date | date:'mediumDate' }}</span> }
              </div>
              <p class="t-card__organizer">by <strong>{{ t.organizer.display_name ?? t.organizer.username }}</strong></p>
            </a>
          } @empty {
            <div class="empty-state">
              <mat-icon>emoji_events</mat-icon>
              <p>No tournaments yet.</p>
              <a mat-stroked-button routerLink="/tournaments/new">Create one</a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px; }
    .page__header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
      h1 { margin: 0; font-size: 20px; font-weight: 700; }
    }
    .filter-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .list { display: flex; flex-direction: column; gap: 12px; }
    .t-card { text-decoration: none; display: block; }
    .t-card__top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .vote-chip { font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(124,58,237,.15); color: #7C3AED; }
    .t-card__title { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--color-text-primary); }
    .t-card__desc {
      margin: 0 0 10px; font-size: 13px; color: var(--color-text-secondary);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .t-card__meta {
      display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px;
      color: var(--color-text-secondary); margin-bottom: 6px;
      span { display: flex; align-items: center; gap: 3px; }
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .t-card__organizer { margin: 0; font-size: 12px; color: var(--color-text-muted); }
    .status-badge {
      padding: 2px 10px; border-radius: 24px; font-size: 11px; font-weight: 600;
      &.status-open      { background: rgba(16,185,129,.15); color: #10B981; }
      &.status-active    { background: rgba(124,58,237,.15); color: #7C3AED; }
      &.status-completed { background: rgba(148,163,184,.1);  color: #94A3B8; }
    }
    .empty-state {
      text-align: center; padding: 48px 16px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      color: var(--color-text-secondary);
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--color-text-muted); }
    }
  `],
})
export class TournamentListComponent implements OnInit {
  private api = inject(ApiService);

  filters = [
    { label: 'All',       value: '' },
    { label: '🟢 Open',   value: 'open' },
    { label: '⚡ Active', value: 'active' },
    { label: '🏆 Done',   value: 'completed' },
  ];

  loading      = signal(true);
  tournaments  = signal<Tournament[]>([]);
  activeFilter = signal('');

  ngOnInit() { this.load(); }

  setFilter(v: string) { this.activeFilter.set(v); this.load(); }

  load() {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.activeFilter()) params['status_filter'] = this.activeFilter();
    this.api.get<Tournament[]>('/tournaments', params).subscribe({
      next: list => { this.tournaments.set(list); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  statusLabel(s: string) {
    return ({ open: '🟢 Open', active: '⚡ Active', completed: '🏆 Completed' } as Record<string, string>)[s] ?? s;
  }
}
