import { Component, inject, Input, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { TrackCardComponent } from '../../../shared/components/track-card/track-card.component';

interface UserProfile {
  id: string; username: string; display_name: string | null; bio: string | null;
  avatar_url: string | null; location: string | null; is_verified: boolean; created_at: string;
}
interface UserStats {
  track_count: number; follower_count: number; following_count: number;
  total_likes_received: number; tournament_wins: number;
}

@Component({
  selector: 'sc-profile-view',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTabsModule, MatProgressSpinnerModule, TrackCardComponent],
  template: `
    @if (loading()) {
      <div class="center"><mat-spinner diameter="48" /></div>
    } @else if (profile()) {
      <div class="page">
        <!-- Profile header -->
        <div class="profile-header">
          <div class="avatar-wrap">
            @if (profile()!.avatar_url) {
              <img [src]="profile()!.avatar_url" class="avatar-img" alt="avatar">
            } @else {
              <div class="avatar-placeholder">
                {{ (profile()!.display_name ?? profile()!.username)[0].toUpperCase() }}
              </div>
            }
            @if (profile()!.is_verified) {
              <span class="verified-badge" title="Verified">✓</span>
            }
          </div>

          <div class="profile-info">
            <div class="name-row">
              <h1 class="display-name">{{ profile()!.display_name ?? profile()!.username }}</h1>
              <span class="username">&#64;{{ profile()!.username }}</span>
            </div>
            @if (profile()!.location) {
              <p class="location"><mat-icon>location_on</mat-icon> {{ profile()!.location }}</p>
            }
            @if (profile()!.bio) {
              <p class="bio">{{ profile()!.bio }}</p>
            }

            <!-- Stats row -->
            @if (stats()) {
              <div class="stats-row">
                <div class="stat-item">
                  <span class="stat-val">{{ stats()!.track_count }}</span>
                  <span class="stat-label">Tracks</span>
                </div>
                <div class="stat-item">
                  <span class="stat-val">{{ stats()!.follower_count }}</span>
                  <span class="stat-label">Followers</span>
                </div>
                <div class="stat-item">
                  <span class="stat-val">{{ stats()!.following_count }}</span>
                  <span class="stat-label">Following</span>
                </div>
                <div class="stat-item">
                  <span class="stat-val">{{ stats()!.total_likes_received }}</span>
                  <span class="stat-label">Likes</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Action buttons -->
        <div class="profile-actions">
          @if (isOwnProfile()) {
            <a mat-stroked-button routerLink="/u/me/edit">
              <mat-icon>edit</mat-icon> Edit Profile
            </a>
          } @else {
            <button mat-flat-button [color]="isFollowing() ? '' : 'primary'" (click)="toggleFollow()">
              <mat-icon>{{ isFollowing() ? 'person_remove' : 'person_add' }}</mat-icon>
              {{ isFollowing() ? 'Unfollow' : 'Follow' }}
            </button>
            <button mat-stroked-button (click)="sendCollab()">
              <mat-icon>handshake</mat-icon> Collab
            </button>
          }
        </div>

        <!-- Tracks tab -->
        <mat-tab-group animationDuration="200ms">
          <mat-tab label="🎵 Tracks">
            <div class="tracks-list">
              @for (track of tracks(); track track.id) {
                <sc-track-card [track]="track" />
              } @empty {
                <div class="empty-state">
                  <mat-icon>music_note</mat-icon>
                  <p>No tracks yet.</p>
                </div>
              }
            </div>
          </mat-tab>

          @if (similar().length > 0) {
            <mat-tab label="🤝 Suggested Collabs">
              <div class="collab-suggestions">
                @for (s of similar(); track s.track.id) {
                  <div class="collab-card sc-card">
                    <div class="collab-card__info">
                      <a [routerLink]="['/tracks', s.track.id]" class="collab-track-title">
                        {{ s.track.title }}
                      </a>
                      <a [routerLink]="['/u', s.track.artist.username]" class="collab-artist">
                        {{ s.track.artist.display_name ?? s.track.artist.username }}
                      </a>
                    </div>
                    <span class="score-chip">{{ (s.similarity_score * 100).toFixed(0) }}% match</span>
                  </div>
                }
              </div>
            </mat-tab>
          }
        </mat-tab-group>
      </div>
    }
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 64px; }
    .page { padding: 16px; }

    /* Profile header */
    .profile-header { display: flex; gap: 16px; margin-bottom: 14px; align-items: flex-start; }
    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar-img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
    .avatar-placeholder {
      width: 72px; height: 72px; border-radius: 50%; background: var(--color-accent-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 700;
    }
    .verified-badge {
      position: absolute; bottom: 0; right: 0; width: 20px; height: 20px;
      background: var(--color-accent-primary); color: white; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; border: 2px solid var(--color-bg-primary);
    }
    .profile-info { flex: 1; min-width: 0; }
    .name-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .display-name { margin: 0; font-size: 18px; font-weight: 700; }
    .username { font-size: 13px; color: var(--color-text-muted); }
    .location {
      display: flex; align-items: center; gap: 3px; font-size: 13px;
      color: var(--color-text-secondary); margin: 2px 0;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .bio { font-size: 13px; color: var(--color-text-secondary); margin: 4px 0; line-height: 1.5; }

    .stats-row { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
    .stat-item { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 44px; }
    .stat-val   { font-size: 17px; font-weight: 700; color: var(--color-text-primary); }
    .stat-label { font-size: 11px; color: var(--color-text-secondary); }

    /* Actions */
    .profile-actions { display: flex; gap: 8px; margin-bottom: 16px; }

    /* Tracks */
    .tracks-list { display: flex; flex-direction: column; gap: 12px; padding: 12px 0; }
    .empty-state {
      text-align: center; padding: 48px 0; display: flex; flex-direction: column;
      align-items: center; gap: 8px; color: var(--color-text-secondary);
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--color-text-muted); }
    }

    /* Collab suggestions */
    .collab-suggestions { display: flex; flex-direction: column; gap: 10px; padding: 12px 0; }
    .collab-card { display: flex; align-items: center; justify-content: space-between; }
    .collab-track-title { font-weight: 600; font-size: 14px; color: var(--color-text-primary);
      text-decoration: none; display: block; &:hover { color: var(--color-accent-primary); } }
    .collab-artist { font-size: 12px; color: var(--color-text-secondary); text-decoration: none; }
    .score-chip { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; flex-shrink: 0;
      background: rgba(124,58,237,.15); color: #7C3AED; }
  `],
})
export class ProfileViewComponent implements OnInit {
  @Input() username!: string;

  private api       = inject(ApiService);
  authStore         = inject(AuthStore);

  loading     = signal(true);
  profile     = signal<UserProfile | null>(null);
  stats       = signal<UserStats | null>(null);
  tracks      = signal<any[]>([]);
  similar     = signal<any[]>([]);
  isFollowing = signal(false);

  isOwnProfile = computed(() => this.authStore.user()?.username === this.username);

  ngOnInit() {
    // If visiting /u/me/edit the route goes to ProfileEditComponent; "me" is handled there.
    this.api.get<UserProfile>(`/users/${this.username}`).subscribe({
      next: p => {
        this.profile.set(p);
        this.loading.set(false);
        this.loadStats();
        this.loadTracks();
      },
      error: () => this.loading.set(false),
    });
  }

  loadStats() {
    this.api.get<UserStats>(`/users/${this.username}/stats`).subscribe({
      next: s => this.stats.set(s),
    });
  }

  loadTracks() {
    this.api.get<any[]>(`/feed/trending?limit=20`).subscribe({
      next: list => {
        // Filter to this artist's tracks
        this.tracks.set(list.filter((t: any) => t.artist?.username === this.username));
      },
    });
  }

  toggleFollow() {
    const following = this.isFollowing();
    const op = following
      ? this.api.delete(`/users/${this.username}/follow`)
      : this.api.post(`/users/${this.username}/follow`, {});
    op.subscribe(() => {
      this.isFollowing.set(!following);
      this.stats.update(s => s ? {
        ...s,
        follower_count: following ? s.follower_count - 1 : s.follower_count + 1
      } : s);
    });
  }

  sendCollab() {
    const profileId = this.profile()?.id;
    if (!profileId) return;
    this.api.post('/social/collab', { recipient_id: profileId, message: 'Hey, want to collab?' }).subscribe();
  }
}
