import { Component, Input, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { PlayerStore } from '../../../core/store/player.store';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'sc-track-card',
  standalone: true,
  imports: [UpperCasePipe, MatIconModule, MatButtonModule, RouterLink],
  template: `
    <div class="sc-card track-card">
      <!-- Artist row -->
      <div class="track-card__artist">
        <div class="avatar">{{ track.artist.display_name?.[0] ?? track.artist.username[0] | uppercase }}</div>
        <div>
          <a [routerLink]="['/u', track.artist.username]" class="artist-name">
            {{ track.artist.display_name ?? track.artist.username }}
          </a>
          @if (track.genre) { <span class="genre-chip sc-chip">{{ track.genre }}</span> }
        </div>
      </div>

      <!-- Title -->
      <a [routerLink]="['/tracks', track.id]" class="track-card__title">{{ track.title }}</a>

      <!-- Waveform placeholder -->
      <div class="waveform-container" (click)="playTrack()">
        @if (track.waveform_url) {
          <img [src]="track.waveform_url" alt="waveform" class="waveform-img">
        } @else {
          <div class="waveform-placeholder">
            <mat-icon>graphic_eq</mat-icon>
          </div>
        }
        <div class="play-overlay">
          <mat-icon>{{ isCurrentTrack ? 'pause_circle' : 'play_circle' }}</mat-icon>
        </div>
      </div>

      <!-- Stats row -->
      <div class="track-card__stats">
        <button class="sc-like-btn" [class.liked]="isLiked" (click)="toggleLike()">
          <mat-icon>{{ isLiked ? 'favorite' : 'favorite_border' }}</mat-icon>
          {{ track.like_count }}
        </button>
        <span class="stat"><mat-icon>play_arrow</mat-icon> {{ track.play_count }}</span>
        @if (track.duration_seconds) {
          <span class="stat">{{ formatDuration(track.duration_seconds) }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .track-card { cursor: default; }
    .track-card__artist {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
      .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--color-accent-primary);
        display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
      .artist-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary);
        text-decoration: none; &:hover { color: var(--color-accent-primary); } }
      .genre-chip { margin-left: 4px; }
    }
    .track-card__title {
      display: block; font-size: 16px; font-weight: 700; margin-bottom: 10px;
      color: var(--color-text-primary); text-decoration: none;
      &:hover { color: var(--color-accent-primary); }
    }
    .waveform-container {
      position: relative; cursor: pointer; border-radius: 8px; overflow: hidden;
      height: 64px; background: var(--color-bg-elevated); margin-bottom: 10px;
      .waveform-img { width: 100%; height: 100%; object-fit: cover; }
      .waveform-placeholder {
        height: 100%; display: flex; align-items: center; justify-content: center;
        color: var(--color-text-muted);
      }
      .play-overlay {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        opacity: 0; transition: opacity 0.2s;
        mat-icon { font-size: 40px; width: 40px; height: 40px; color: white; }
      }
      &:hover .play-overlay { opacity: 1; }
    }
    .track-card__stats {
      display: flex; align-items: center; gap: 16px;
      .stat { display: flex; align-items: center; gap: 2px; font-size: 13px;
        color: var(--color-text-secondary); mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    }
  `],
})
export class TrackCardComponent {
  @Input({ required: true }) track!: any;

  private playerStore = inject(PlayerStore);
  private api = inject(ApiService);

  isLiked = false;

  get isCurrentTrack(): boolean {
    return this.playerStore.currentTrack()?.id === this.track.id && this.playerStore.isPlaying();
  }

  playTrack() {
    if (this.isCurrentTrack) {
      this.playerStore.pause();
    } else {
      this.playerStore.play({
        id: this.track.id,
        title: this.track.title,
        audio_url: this.track.audio_url,
        waveform_url: this.track.waveform_url,
        artist: this.track.artist,
      });
    }
  }

  toggleLike() {
    const path = `/tracks/${this.track.id}/like`;
    if (this.isLiked) {
      this.api.delete(path).subscribe(() => {
        this.isLiked = false;
        this.track = { ...this.track, like_count: this.track.like_count - 1 };
      });
    } else {
      this.api.post(path, {}).subscribe(() => {
        this.isLiked = true;
        this.track = { ...this.track, like_count: this.track.like_count + 1 };
      });
    }
  }

  formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}
