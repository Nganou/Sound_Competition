import { Component, inject, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';

interface Track {
  id: string; title: string; audio_url: string; waveform_url: string | null;
  play_count: number; like_count: number; duration_seconds: number | null;
  genre: string | null; artist: { username: string; display_name: string | null; avatar_url: string | null };
}

interface FeedResponse {
  trending_tracks: Track[];
  active_tournaments: unknown[];
  following_tracks: Track[];
  suggested_artists: unknown[];
}

@Component({
  selector: 'sc-feed',
  standalone: true,
  imports: [MatProgressSpinnerModule, TrackCardComponent],
  template: `
    <div class="feed">
      <header class="feed__header">
        <h1>🔥 Trending</h1>
      </header>

      @if (loading()) {
        <div class="feed__spinner"><mat-spinner diameter="40" /></div>
      } @else {
        <section class="feed__section">
          @for (track of trending(); track track.id) {
            <sc-track-card [track]="track" />
          }
          @empty {
            <p class="feed__empty">No tracks yet. Be the first to upload!</p>
          }
        </section>

        @if (following().length > 0) {
          <header class="feed__header">
            <h2>🎧 Following</h2>
          </header>
          <section class="feed__section">
            @for (track of following(); track track.id) {
              <sc-track-card [track]="track" />
            }
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .feed { padding: 16px; }
    .feed__header h1, .feed__header h2 { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
    .feed__section { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
    .feed__spinner { display: flex; justify-content: center; padding: 48px; }
    .feed__empty { color: var(--color-text-secondary); text-align: center; padding: 32px 0; }
  `],
})
export class FeedComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  trending = signal<Track[]>([]);
  following = signal<Track[]>([]);

  ngOnInit() {
    this.api.get<FeedResponse>('/feed').subscribe({
      next: feed => {
        this.trending.set(feed.trending_tracks);
        this.following.set(feed.following_tracks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
