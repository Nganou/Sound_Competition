import { Component, inject, OnInit, signal, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { PlayerStore } from '../../core/store/player.store';

@Component({
  selector: 'sc-battle-view',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  template: `
    @if (loading()) {
      <div class="center"><mat-spinner diameter="48" /></div>
    } @else if (match()) {
      <div class="battle">
        <div class="battle__header">
          <h1>⚔ Battle — Round {{ match()!.round_number }}</h1>
        </div>

        <div class="battle__sides">
          <!-- Side A -->
          <div class="battle__side" [class.winner]="match()!.result_status === 'track_a_wins'">
            <div class="side__player">
              <a [routerLink]="['/u', match()!.participant_a.username]" class="side__name">
                {{ match()!.participant_a.display_name ?? match()!.participant_a.username }}
              </a>
              @if (match()!.track_a) {
                <p class="side__track">{{ match()!.track_a!.title }}</p>
                <button mat-stroked-button (click)="playTrack(match()!.track_a!, 'a')">
                  <mat-icon>{{ playing() === 'a' ? 'pause' : 'play_arrow' }}</mat-icon>
                  {{ playing() === 'a' ? 'Pause' : 'Play' }}
                </button>
              }
            </div>
            @if (match()!.result_status === 'pending') {
              <button mat-flat-button color="primary" (click)="vote('a')" [disabled]="userVote() !== null">
                @if (userVote() === 'a') { ✓ Voted } @else { Vote }
              </button>
            }
            <div class="side__votes">{{ match()!.vote_a_count }} votes</div>
          </div>

          <div class="battle__vs">VS</div>

          <!-- Side B -->
          <div class="battle__side" [class.winner]="match()!.result_status === 'track_b_wins'">
            <div class="side__player">
              <a [routerLink]="['/u', match()!.participant_b?.username]" class="side__name">
                {{ match()!.participant_b?.display_name ?? match()!.participant_b?.username ?? 'BYE' }}
              </a>
              @if (match()!.track_b) {
                <p class="side__track">{{ match()!.track_b!.title }}</p>
                <button mat-stroked-button (click)="playTrack(match()!.track_b!, 'b')">
                  <mat-icon>{{ playing() === 'b' ? 'pause' : 'play_arrow' }}</mat-icon>
                  {{ playing() === 'b' ? 'Pause' : 'Play' }}
                </button>
              }
            </div>
            @if (match()!.result_status === 'pending') {
              <button mat-flat-button color="accent" (click)="vote('b')" [disabled]="userVote() !== null">
                @if (userVote() === 'b') { ✓ Voted } @else { Vote }
              </button>
            }
            <div class="side__votes">{{ match()!.vote_b_count }} votes</div>
          </div>
        </div>

        <!-- Vote bar -->
        <div class="vote-bar" style="margin-top: 16px;">
          <div class="vote-a" [style.width.%]="votePercent('a')"></div>
          <div class="vote-b" [style.width.%]="votePercent('b')"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 64px; }
    .battle { padding: 16px; }
    .battle__header h1 { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
    .battle__sides { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; }
    .battle__vs { font-size: 24px; font-weight: 900; color: var(--color-accent-primary); }
    .battle__side {
      background: var(--color-bg-surface); border-radius: var(--radius-card);
      border: 2px solid var(--color-border); padding: 16px;
      display: flex; flex-direction: column; gap: 12px; align-items: center; text-align: center;
      &.winner { border-color: var(--color-accent-gold); }
    }
    .side__name { font-size: 14px; font-weight: 700; color: var(--color-text-primary); text-decoration: none;
      &:hover { color: var(--color-accent-primary); } }
    .side__track { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    .side__votes { font-size: 13px; color: var(--color-text-secondary); font-weight: 500; }
  `],
})
export class BattleViewComponent implements OnInit {
  @Input() id!: string;  // from route :id via withComponentInputBinding

  private api = inject(ApiService);
  private playerStore = inject(PlayerStore);

  loading = signal(true);
  match = signal<any>(null);
  playing = signal<'a' | 'b' | null>(null);
  userVote = signal<'a' | 'b' | null>(null);

  ngOnInit() {
    this.api.get<any>(`/matches/${this.id}`).subscribe({
      next: m => {
        this.match.set(m);
        this.userVote.set(m.user_vote ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  playTrack(track: any, side: 'a' | 'b') {
    if (this.playing() === side) {
      this.playerStore.pause();
      this.playing.set(null);
    } else {
      this.playerStore.play({ id: track.id, title: track.title, audio_url: track.audio_url, waveform_url: track.waveform_url, artist: track.artist });
      this.playing.set(side);
    }
  }

  vote(side: 'a' | 'b') {
    this.api.post(`/matches/${this.id}/vote`, { voted_for: side }).subscribe(() => {
      this.userVote.set(side);
      const m = this.match();
      if (m) {
        this.match.set({
          ...m,
          vote_a_count: side === 'a' ? m.vote_a_count + 1 : m.vote_a_count,
          vote_b_count: side === 'b' ? m.vote_b_count + 1 : m.vote_b_count,
        });
      }
    });
  }

  votePercent(side: 'a' | 'b'): number {
    const m = this.match();
    if (!m) return 50;
    const total = m.vote_a_count + m.vote_b_count;
    if (total === 0) return 50;
    return side === 'a'
      ? Math.round((m.vote_a_count / total) * 100)
      : Math.round((m.vote_b_count / total) * 100);
  }
}
