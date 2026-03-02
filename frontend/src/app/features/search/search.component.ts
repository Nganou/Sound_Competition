import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { PlayerStore } from '../../core/store/player.store';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, takeUntil } from 'rxjs';

interface TrackResult {
  id: string;
  title: string;
  artist_username: string;
  artist_display_name: string;
  waveform_url: string | null;
  audio_url: string;
  genre: string | null;
  play_count: number;
  likes_count: number;
  duration: number;
}

interface UserResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  follower_count: number;
  track_count: number;
  bio: string | null;
}

interface TournamentResult {
  id: string;
  title: string;
  status: 'open' | 'active' | 'completed';
  organizer_username: string;
  participant_count: number;
  current_round: number;
}

interface SearchResults {
  tracks: TrackResult[];
  users: UserResult[];
  tournaments: TournamentResult[];
}

@Component({
  selector: 'sc-search',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-container">
      <!-- Search bar -->
      <div class="search-bar-wrapper">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            type="search"
            [formControl]="queryCtrl"
            class="search-input"
            placeholder="Search tracks, artists, tournaments…"
            autocomplete="off"
            autocorrect="off"
          />
          @if (queryCtrl.value) {
            <button class="clear-btn" (click)="queryCtrl.setValue('')">
              <span class="material-symbols-outlined">close</span>
            </button>
          }
        </div>
      </div>

      @if (!queryCtrl.value) {
        <!-- Trending / discovery state -->
        <div class="discover-section">
          <h2 class="section-heading">Trending Tracks</h2>
          @if (trendingLoading()) {
            <div class="track-skeletons">
              @for (_ of [1,2,3,4,5]; track $index) {
                <div class="track-skeleton"></div>
              }
            </div>
          } @else {
            @for (track of trendingTracks(); track track.id) {
              <div class="track-row" (click)="playTrack(track)">
                <div class="track-rank">{{ $index + 1 }}</div>
                <div class="track-info">
                  <span class="track-title">{{ track.title }}</span>
                  <span class="track-meta">
                    @{{ track.artist_username }}
                    @if (track.genre) { · {{ track.genre }} }
                  </span>
                </div>
                <div class="track-stats">
                  <span class="stat-item">
                    <span class="material-symbols-outlined">play_arrow</span>
                    {{ formatCount(track.play_count) }}
                  </span>
                </div>
              </div>
            }
          }

          <h2 class="section-heading" style="margin-top:24px">Browse Tags</h2>
          <div class="tag-cloud">
            @for (tag of popularTags(); track tag) {
              <button class="tag-chip" (click)="queryCtrl.setValue('#' + tag)">
                #{{ tag }}
              </button>
            }
          </div>
        </div>
      } @else {
        <!-- Results tabs -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeTab() === 'tracks'" (click)="activeTab.set('tracks')">
            Tracks
            @if (results()?.tracks?.length) {
              <span class="count-badge">{{ results()!.tracks.length }}</span>
            }
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'artists'" (click)="activeTab.set('artists')">
            Artists
            @if (results()?.users?.length) {
              <span class="count-badge">{{ results()!.users.length }}</span>
            }
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'tournaments'" (click)="activeTab.set('tournaments')">
            Battles
            @if (results()?.tournaments?.length) {
              <span class="count-badge">{{ results()!.tournaments.length }}</span>
            }
          </button>
        </div>

        @if (searching()) {
          <div class="search-loading">
            <div class="spinner"></div>
          </div>
        } @else if (results()) {

          <!-- Tracks tab -->
          @if (activeTab() === 'tracks') {
            @if (results()!.tracks.length === 0) {
              <div class="empty-tab">No tracks found for "{{ queryCtrl.value }}"</div>
            }
            @for (track of results()!.tracks; track track.id) {
              <div class="track-row" (click)="playTrack(track)">
                <div class="track-cover">
                  @if (track.waveform_url) {
                    <img [src]="track.waveform_url" alt="waveform" class="waveform-thumb" />
                  } @else {
                    <div class="waveform-placeholder">
                      <span class="material-symbols-outlined">music_note</span>
                    </div>
                  }
                </div>
                <div class="track-info">
                  <span class="track-title">{{ track.title }}</span>
                  <span class="track-meta">
                    <a [routerLink]="['/u', track.artist_username]" class="artist-link" (click)="$event.stopPropagation()">
                      @{{ track.artist_username }}
                    </a>
                    @if (track.genre) { · {{ track.genre }} }
                    · {{ formatDuration(track.duration) }}
                  </span>
                </div>
                <div class="track-stats">
                  <span class="stat-item">
                    <span class="material-symbols-outlined">favorite</span>
                    {{ formatCount(track.likes_count) }}
                  </span>
                </div>
              </div>
            }
          }

          <!-- Artists tab -->
          @if (activeTab() === 'artists') {
            @if (results()!.users.length === 0) {
              <div class="empty-tab">No artists found for "{{ queryCtrl.value }}"</div>
            }
            @for (user of results()!.users; track user.id) {
              <a [routerLink]="['/u', user.username]" class="user-row">
                @if (user.avatar_url) {
                  <img [src]="user.avatar_url" [alt]="user.display_name" class="avatar-md" />
                } @else {
                  <div class="avatar-md avatar-placeholder">
                    {{ user.display_name[0].toUpperCase() }}
                  </div>
                }
                <div class="user-info">
                  <div class="user-name-row">
                    <span class="user-name">{{ user.display_name }}</span>
                    @if (user.is_verified) {
                      <span class="material-symbols-outlined verified-icon">verified</span>
                    }
                  </div>
                  <span class="user-meta">
                    @{{ user.username }} · {{ user.track_count }} tracks · {{ formatCount(user.follower_count) }} followers
                  </span>
                  @if (user.bio) {
                    <span class="user-bio">{{ user.bio }}</span>
                  }
                </div>
              </a>
            }
          }

          <!-- Tournaments tab -->
          @if (activeTab() === 'tournaments') {
            @if (results()!.tournaments.length === 0) {
              <div class="empty-tab">No tournaments found for "{{ queryCtrl.value }}"</div>
            }
            @for (t of results()!.tournaments; track t.id) {
              <a [routerLink]="['/tournaments', t.id]" class="tournament-row">
                <div class="t-icon">
                  <span class="material-symbols-outlined">emoji_events</span>
                </div>
                <div class="t-info">
                  <span class="t-title">{{ t.title }}</span>
                  <span class="t-meta">
                    by @{{ t.organizer_username }} · {{ t.participant_count }} participants · Round {{ t.current_round }}
                  </span>
                </div>
                <span class="status-chip" [attr.data-status]="t.status">{{ t.status }}</span>
              </a>
            }
          }
        }
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 600px; margin: 0 auto; padding: 0 0 80px; }
    .search-bar-wrapper {
      padding: 12px 16px; position: sticky; top: 0;
      background: var(--color-bg-primary); z-index: 10;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .search-input-wrap {
      display: flex; align-items: center; gap: 8px;
      background: var(--color-bg-surface); border-radius: 12px; padding: 10px 14px;
    }
    .search-icon { font-size: 20px; color: var(--color-text-secondary); }
    .search-input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--color-text-primary); font-size: 16px;
    }
    .search-input::placeholder { color: var(--color-text-secondary); }
    .clear-btn {
      background: none; border: none; padding: 0; cursor: pointer;
      color: var(--color-text-secondary); display: flex; align-items: center;
    }
    .discover-section { padding: 16px; }
    .section-heading { font-size: 16px; font-weight: 700; margin: 0 0 12px; }
    .track-skeletons { display: flex; flex-direction: column; gap: 4px; }
    .track-skeleton {
      height: 56px; background: var(--color-bg-surface); border-radius: 8px;
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
    .tag-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag-chip {
      padding: 6px 14px; border-radius: 20px; border: none;
      background: var(--color-bg-surface); color: var(--color-accent-primary);
      font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s;
    }
    .tag-chip:hover { background: var(--color-bg-elevated); }
    .tab-bar {
      display: flex; border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0 12px; gap: 4px; overflow-x: auto;
    }
    .tab-btn {
      background: none; border: none; padding: 12px 14px;
      color: var(--color-text-secondary); font-size: 14px; font-weight: 500;
      cursor: pointer; display: flex; align-items: center; gap: 6px;
      border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;
    }
    .tab-btn.active { color: var(--color-accent-primary); border-bottom-color: var(--color-accent-primary); }
    .count-badge {
      background: var(--color-bg-elevated); color: var(--color-text-secondary);
      border-radius: 10px; padding: 1px 6px; font-size: 11px;
    }
    .search-loading { display: flex; justify-content: center; padding: 48px; }
    .spinner {
      width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
      border-top-color: var(--color-accent-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-tab { padding: 48px 24px; text-align: center; color: var(--color-text-secondary); }
    .track-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; cursor: pointer; transition: background 0.15s;
    }
    .track-row:hover { background: var(--color-bg-surface); }
    .track-rank { width: 24px; text-align: center; color: var(--color-text-secondary); font-size: 14px; }
    .track-cover { flex-shrink: 0; }
    .waveform-thumb { width: 48px; height: 32px; border-radius: 4px; object-fit: cover; }
    .waveform-placeholder {
      width: 48px; height: 32px; border-radius: 4px;
      background: var(--color-bg-elevated);
      display: flex; align-items: center; justify-content: center;
      color: var(--color-text-secondary);
    }
    .waveform-placeholder .material-symbols-outlined { font-size: 16px; }
    .track-info { flex: 1; min-width: 0; }
    .track-title { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track-meta { display: block; font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .artist-link { color: inherit; text-decoration: none; }
    .artist-link:hover { color: var(--color-accent-primary); }
    .track-stats { display: flex; gap: 8px; }
    .stat-item { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--color-text-secondary); }
    .stat-item .material-symbols-outlined { font-size: 14px; }
    .user-row {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; text-decoration: none;
      transition: background 0.15s;
    }
    .user-row:hover { background: var(--color-bg-surface); }
    .avatar-md { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .avatar-placeholder {
      background: var(--color-accent-primary); color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;
    }
    .user-info { flex: 1; min-width: 0; }
    .user-name-row { display: flex; align-items: center; gap: 4px; }
    .user-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
    .verified-icon { font-size: 14px; color: var(--color-accent-primary); }
    .user-meta { display: block; font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
    .user-bio { display: block; font-size: 13px; color: var(--color-text-secondary); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tournament-row {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; text-decoration: none; transition: background 0.15s;
    }
    .tournament-row:hover { background: var(--color-bg-surface); }
    .t-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(245,158,11,0.15); display: flex; align-items: center; justify-content: center;
      color: var(--color-accent-gold); flex-shrink: 0;
    }
    .t-info { flex: 1; min-width: 0; }
    .t-title { display: block; font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
    .t-meta { display: block; font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
    .status-chip { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
    .status-chip[data-status="open"] { background: rgba(52,211,153,0.15); color: #34d399; }
    .status-chip[data-status="active"] { background: rgba(124,58,237,0.15); color: var(--color-accent-primary); }
    .status-chip[data-status="completed"] { background: rgba(148,163,184,0.15); color: var(--color-text-secondary); }
  `]
})
export class SearchComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private playerStore = inject(PlayerStore);
  private destroy$ = new Subject<void>();

  queryCtrl = new FormControl('');
  activeTab = signal<'tracks' | 'artists' | 'tournaments'>('tracks');
  results = signal<SearchResults | null>(null);
  searching = signal(false);
  trendingTracks = signal<TrackResult[]>([]);
  trendingLoading = signal(true);
  popularTags = signal<string[]>(['hiphop', 'trap', 'lofi', 'electronic', 'rnb', 'jazz', 'afrobeats', 'drill', 'soul', 'ambient', 'house', 'reggaeton']);

  ngOnInit() {
    this.api.get<{ tracks: TrackResult[] }>('/feed?limit=10').subscribe({
      next: (res) => { this.trendingTracks.set(res.tracks ?? []); this.trendingLoading.set(false); },
      error: () => this.trendingLoading.set(false),
    });

    this.queryCtrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q || q.trim().length < 2) {
          this.results.set(null);
          return of(null);
        }
        this.searching.set(true);
        return this.api.get<SearchResults>('/feed/search', { q: q.trim() });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (res) => {
        if (res) this.results.set(res);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  playTrack(track: TrackResult) {
    this.playerStore.play({ id: track.id, title: track.title, artist: track.artist_display_name, audioUrl: track.audio_url, waveformUrl: track.waveform_url ?? undefined });
  }

  formatCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}
