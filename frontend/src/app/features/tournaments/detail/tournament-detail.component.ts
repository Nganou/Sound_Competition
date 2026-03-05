import { Component, inject, Input, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthStore } from '../../../core/store/auth.store';

interface Participant {
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  track: { id: string; title: string; audio_url: string } | null;
  score: number; wins: number; losses: number; draws: number;
  matches_played: number; is_eliminated: boolean;
}
interface Standing { rank: number; participant: Participant; }
interface Match {
  id: string; round_number: number; result_status: string;
  vote_a_count: number; vote_b_count: number;
  participant_a: { username: string; display_name: string | null };
  participant_b: { username: string; display_name: string | null } | null;
  track_a: { id: string; title: string } | null;
  track_b: { id: string; title: string } | null;
}
interface Tournament {
  id: string; title: string; description: string | null; status: string;
  voting_enabled: boolean; current_round: number; total_rounds: number | null;
  start_date: string | null; end_date: string | null; participant_count: number;
  organizer: { id: string; username: string; display_name: string | null };
  standings: Standing[];
}

@Component({
  selector: 'sc-tournament-detail',
  standalone: true,
  imports: [
    RouterLink, MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatDividerModule, DatePipe,
  ],
  template: `
    @if (loading()) {
      <div class="center"><mat-spinner diameter="48" /></div>
    } @else if (t()) {
      <div class="page">
        <!-- Hero -->
        <div class="hero">
          <div class="hero__status-row">
            <span class="status-badge" [class]="'status-' + t()!.status">{{ statusLabel(t()!.status) }}</span>
            @if (t()!.voting_enabled) { <span class="vote-chip">🗳 Community vote</span> }
          </div>
          <h1 class="hero__title">{{ t()!.title }}</h1>
          @if (t()!.description) { <p class="hero__desc">{{ t()!.description }}</p> }
          <div class="hero__meta">
            <span><mat-icon>people</mat-icon> {{ t()!.participant_count }} artists</span>
            <span><mat-icon>flag</mat-icon> Round {{ t()!.current_round }}</span>
            @if (t()!.start_date) {
              <span><mat-icon>calendar_today</mat-icon> {{ t()!.start_date | date:'mediumDate' }}</span>
            }
          </div>
          <p class="hero__organizer">
            Organized by
            <a [routerLink]="['/u', t()!.organizer.username]">
              {{ t()!.organizer.display_name ?? t()!.organizer.username }}
            </a>
          </p>
        </div>

        <!-- Action buttons -->
        <div class="actions">
          @if (isOrganizer()) {
            @if (t()!.status !== 'completed') {
              <button mat-flat-button color="primary" (click)="advanceRound()" [disabled]="advancing()">
                @if (advancing()) { <mat-spinner diameter="18" /> }
                @else { <mat-icon>chevron_right</mat-icon> }
                {{ t()!.status === 'open' ? 'Start Tournament' : 'Next Round' }}
              </button>
            }
          } @else if (t()!.status === 'open') {
            @if (isJoined()) {
              <button mat-stroked-button (click)="leave()">Leave</button>
            } @else {
              <button mat-flat-button color="primary" (click)="join()">Join</button>
            }
          }
        </div>

        @if (advanceError()) { <p class="error">{{ advanceError() }}</p> }

        <!-- Tabs: Standings / Matches -->
        <mat-tab-group animationDuration="200ms">
          <!-- Standings tab -->
          <mat-tab label="🏆 Standings">
            <div class="standings">
              @if (t()!.standings.length === 0) {
                <p class="empty">No participants yet.</p>
              }
              @for (entry of t()!.standings; track entry.rank) {
                <div class="standing-row" [class.eliminated]="entry.participant.is_eliminated">
                  <span class="rank" [class.top3]="entry.rank <= 3">
                    {{ entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : entry.rank }}
                  </span>
                  <div class="standing-artist">
                    <a [routerLink]="['/u', entry.participant.user.username]" class="artist-link">
                      {{ entry.participant.user.display_name ?? entry.participant.user.username }}
                    </a>
                    @if (entry.participant.track) {
                      <span class="track-name">{{ entry.participant.track.title }}</span>
                    }
                  </div>
                  <div class="standing-stats">
                    <span class="score">{{ entry.participant.score }}pt</span>
                    <span class="record">{{ entry.participant.wins }}W–{{ entry.participant.losses }}L</span>
                  </div>
                </div>
                <mat-divider />
              }
            </div>
          </mat-tab>

          <!-- Matches tab -->
          <mat-tab label="⚔ Battles">
            <div class="matches">
              @if (matches().length === 0) {
                <p class="empty">No battles yet — advance to Round 1 to generate pairings.</p>
              }
              @for (round of rounds(); track round) {
                <h3 class="round-header">Round {{ round }}</h3>
                @for (m of matchesByRound(round); track m.id) {
                  <a [routerLink]="['/battles', m.id]" class="match-card sc-card">
                    <div class="match-card__sides">
                      <div class="match-side" [class.winner]="m.result_status === 'track_a_wins'">
                        <span class="side-name">{{ m.participant_a.display_name ?? m.participant_a.username }}</span>
                        @if (m.track_a) { <span class="side-track">{{ m.track_a.title }}</span> }
                      </div>
                      <div class="match-vs">
                        <span class="vs-text">VS</span>
                        <span class="result-badge" [class]="resultClass(m.result_status)">
                          {{ resultLabel(m.result_status) }}
                        </span>
                      </div>
                      <div class="match-side right" [class.winner]="m.result_status === 'track_b_wins'">
                        <span class="side-name">{{ m.participant_b?.display_name ?? m.participant_b?.username ?? 'BYE' }}</span>
                        @if (m.track_b) { <span class="side-track">{{ m.track_b.title }}</span> }
                      </div>
                    </div>
                    @if (m.result_status === 'pending' && (m.vote_a_count + m.vote_b_count) > 0) {
                      <div class="vote-preview">
                        <div class="vote-bar">
                          <div class="vote-a" [style.width.%]="votePercent(m, 'a')"></div>
                          <div class="vote-b" [style.width.%]="votePercent(m, 'b')"></div>
                        </div>
                        <div class="vote-counts">
                          <span>{{ m.vote_a_count }}</span>
                          <span>{{ m.vote_b_count }}</span>
                        </div>
                      </div>
                    }
                  </a>
                }
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    }
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 64px; }
    .page { padding: 16px; }

    /* Hero */
    .hero { margin-bottom: 16px; }
    .hero__status-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .vote-chip { font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(124,58,237,.15); color: #7C3AED; }
    .hero__title { margin: 0 0 8px; font-size: 22px; font-weight: 700; }
    .hero__desc { margin: 0 0 10px; color: var(--color-text-secondary); font-size: 14px; }
    .hero__meta {
      display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px;
      color: var(--color-text-secondary); margin-bottom: 6px;
      span { display: flex; align-items: center; gap: 3px; }
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .hero__organizer {
      font-size: 13px; color: var(--color-text-muted); margin: 0;
      a { color: var(--color-accent-primary); text-decoration: none; }
    }
    .status-badge {
      padding: 2px 10px; border-radius: 24px; font-size: 11px; font-weight: 600;
      &.status-open      { background: rgba(16,185,129,.15); color: #10B981; }
      &.status-active    { background: rgba(124,58,237,.15); color: #7C3AED; }
      &.status-completed { background: rgba(148,163,184,.1);  color: #94A3B8; }
    }

    /* Actions */
    .actions { display: flex; gap: 8px; margin-bottom: 16px; }
    .error { color: var(--color-accent-hot); font-size: 13px; }

    /* Standings */
    .standings { padding: 12px 0; }
    .standing-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 0;
      &.eliminated { opacity: 0.45; }
    }
    .rank { font-size: 18px; min-width: 32px; text-align: center; font-weight: 700;
      &.top3 { font-size: 22px; } }
    .standing-artist { flex: 1; min-width: 0; }
    .artist-link {
      display: block; font-weight: 600; font-size: 14px; color: var(--color-text-primary);
      text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      &:hover { color: var(--color-accent-primary); }
    }
    .track-name { font-size: 12px; color: var(--color-text-secondary); }
    .standing-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .score  { font-size: 16px; font-weight: 700; color: var(--color-accent-gold); }
    .record { font-size: 11px; color: var(--color-text-secondary); }
    .empty  { padding: 24px 0; color: var(--color-text-secondary); text-align: center; }

    /* Matches */
    .matches { padding: 12px 0; display: flex; flex-direction: column; gap: 10px; }
    .round-header { font-size: 13px; font-weight: 700; color: var(--color-text-secondary);
      text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 4px; }
    .match-card { text-decoration: none; display: block; }
    .match-card__sides { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; }
    .match-side {
      padding: 8px; border-radius: 8px; border: 1px solid var(--color-border);
      &.winner { border-color: var(--color-accent-gold); background: rgba(245,158,11,.08); }
      &.right { text-align: right; }
    }
    .side-name  { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .side-track { display: block; font-size: 11px; color: var(--color-text-secondary); }
    .match-vs   { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .vs-text    { font-size: 12px; font-weight: 900; color: var(--color-text-muted); }
    .result-badge {
      font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px;
      &.pending   { background: rgba(148,163,184,.1); color: #94A3B8; }
      &.decided   { background: rgba(245,158,11,.15);  color: var(--color-accent-gold); }
      &.draw      { background: rgba(16,185,129,.15);  color: #10B981; }
    }
    .vote-preview { margin-top: 8px; }
    .vote-counts { display: flex; justify-content: space-between; font-size: 11px;
      color: var(--color-text-secondary); margin-top: 3px; }
  `],
})
export class TournamentDetailComponent implements OnInit {
  @Input() id!: string;

  private api       = inject(ApiService);
  private authStore = inject(AuthStore);

  loading      = signal(true);
  advancing    = signal(false);
  advanceError = signal('');
  t            = signal<Tournament | null>(null);
  matches      = signal<Match[]>([]);
  isJoined     = signal(false);

  isOrganizer = computed(() => {
    const user = this.authStore.user();
    return !!user && !!this.t() && this.t()!.organizer.id === user.id;
  });

  rounds = computed(() => [...new Set(this.matches().map(m => m.round_number))].sort((a, b) => a - b));

  ngOnInit() { this.loadTournament(); }

  loadTournament() {
    this.loading.set(true);
    this.api.get<Tournament>(`/tournaments/${this.id}`).subscribe({
      next: data => { this.t.set(data); this.loading.set(false); this.loadMatches(); },
      error: ()   => this.loading.set(false),
    });
  }

  loadMatches() {
    this.api.get<Match[]>(`/tournaments/${this.id}/matches`).subscribe({
      next: list => this.matches.set(list),
    });
  }

  advanceRound() {
    this.advancing.set(true);
    this.advanceError.set('');
    this.api.post<Match[]>(`/tournaments/${this.id}/advance`, {}).subscribe({
      next: newMatches => {
        this.matches.update(m => [...m, ...newMatches]);
        this.advancing.set(false);
        this.loadTournament();
      },
      error: e => { this.advanceError.set(e.error?.detail ?? 'Failed to advance'); this.advancing.set(false); },
    });
  }

  join() {
    this.api.post(`/tournaments/${this.id}/join`, {}).subscribe({
      next: () => { this.isJoined.set(true); this.loadTournament(); },
    });
  }

  leave() {
    this.api.delete(`/tournaments/${this.id}/join`).subscribe({
      next: () => { this.isJoined.set(false); this.loadTournament(); },
    });
  }

  matchesByRound(round: number) { return this.matches().filter(m => m.round_number === round); }

  votePercent(m: Match, side: 'a' | 'b'): number {
    const total = m.vote_a_count + m.vote_b_count;
    if (!total) return 50;
    return Math.round(((side === 'a' ? m.vote_a_count : m.vote_b_count) / total) * 100);
  }

  statusLabel(s: string) {
    return ({ open: '🟢 Open', active: '⚡ Active', completed: '🏆 Completed' } as Record<string, string>)[s] ?? s;
  }

  resultLabel(s: string) {
    if (s === 'pending') return 'Pending';
    if (s === 'draw')    return 'Draw';
    return 'Decided';
  }

  resultClass(s: string) {
    if (s === 'pending') return 'pending';
    if (s === 'draw')    return 'draw';
    return 'decided';
  }
}
