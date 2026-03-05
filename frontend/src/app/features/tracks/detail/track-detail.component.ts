import { Component, inject, Input, OnInit, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { PlayerStore } from '../../../core/store/player.store';
import { AuthStore } from '../../../core/store/auth.store';

interface Track {
  id: string; title: string; description: string | null; genre: string | null; bpm: number | null;
  audio_url: string; waveform_url: string | null; duration_seconds: number | null;
  play_count: number; like_count: number; comment_count: number; is_public: boolean;
  is_liked: boolean; fingerprint_status: string | null;
  tags: { id: number; name: string }[];
  artist: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  created_at: string;
}
interface Comment {
  id: string; body: string; created_at: string;
  author: { username: string; display_name: string | null; avatar_url: string | null };
}
interface SimilarTrack {
  track: { id: string; title: string; audio_url: string; artist: { username: string; display_name: string | null } };
  similarity_score: number; report_type: string;
}

@Component({
  selector: 'sc-track-detail',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    @if (loading()) {
      <div class="center"><mat-spinner diameter="48" /></div>
    } @else if (track()) {
      <div class="page">
        <!-- Artist row -->
        <div class="artist-row">
          <div class="avatar">
            {{ (track()!.artist.display_name ?? track()!.artist.username)[0].toUpperCase() }}
          </div>
          <div>
            <a [routerLink]="['/u', track()!.artist.username]" class="artist-name">
              {{ track()!.artist.display_name ?? track()!.artist.username }}
            </a>
            <span class="date">{{ formatDate(track()!.created_at) }}</span>
          </div>
          @if (track()!.fingerprint_status) {
            <span class="fp-badge" [class]="fpClass(track()!.fingerprint_status!)">
              {{ fpLabel(track()!.fingerprint_status!) }}
            </span>
          }
        </div>

        <!-- Title + tags -->
        <h1 class="track-title">{{ track()!.title }}</h1>
        <div class="tag-row">
          @if (track()!.genre) { <span class="sc-chip">{{ track()!.genre }}</span> }
          @if (track()!.bpm)   { <span class="sc-chip">{{ track()!.bpm }} BPM</span> }
          @for (tag of track()!.tags; track tag.id) {
            <span class="sc-chip">#{{ tag.name }}</span>
          }
        </div>

        <!-- Waveform player -->
        <div class="player-card">
          <div #waveformEl class="waveform"></div>
          <div class="player-controls">
            <button mat-icon-button (click)="togglePlay()">
              <mat-icon>{{ isPlaying() ? 'pause_circle' : 'play_circle' }}</mat-icon>
            </button>
            <span class="time">{{ formatTime(currentTime()) }} / {{ formatTime(track()!.duration_seconds ?? 0) }}</span>
          </div>
        </div>

        <!-- Stats + actions -->
        <div class="actions-row">
          <button class="sc-like-btn" [class.liked]="isLiked()" (click)="toggleLike()">
            <mat-icon>{{ isLiked() ? 'favorite' : 'favorite_border' }}</mat-icon>
            {{ likeCount() }}
          </button>
          <span class="stat"><mat-icon>play_arrow</mat-icon> {{ track()!.play_count }}</span>
          <button mat-icon-button (click)="share()"><mat-icon>share</mat-icon></button>
        </div>

        @if (track()!.description) {
          <p class="description">{{ track()!.description }}</p>
        }

        <!-- Similar tracks -->
        @if (similar().length > 0) {
          <section class="section">
            <h2 class="section-title">🤝 Similar Tracks (Collab opportunities)</h2>
            <div class="similar-list">
              @for (s of similar(); track s.track.id) {
                <a [routerLink]="['/tracks', s.track.id]" class="similar-card sc-card">
                  <div class="similar-info">
                    <span class="similar-title">{{ s.track.title }}</span>
                    <span class="similar-artist">{{ s.track.artist.display_name ?? s.track.artist.username }}</span>
                  </div>
                  <span class="score-chip">{{ (s.similarity_score * 100).toFixed(0) }}% match</span>
                </a>
              }
            </div>
          </section>
        }

        <!-- Comments -->
        <section class="section">
          <h2 class="section-title">💬 Comments ({{ track()!.comment_count }})</h2>

          @if (authStore.user()) {
            <div class="comment-form">
              <div class="avatar sm">
                {{ authStore.user()!.username[0].toUpperCase() }}
              </div>
              <div class="comment-input-wrap">
                <textarea
                  [formControl]="commentControl"
                  placeholder="Add a comment…"
                  rows="2"
                  class="comment-textarea"></textarea>
                <button mat-flat-button color="primary"
                  [disabled]="commentControl.invalid || submittingComment()"
                  (click)="postComment()">
                  Post
                </button>
              </div>
            </div>
          }

          <div class="comments-list">
            @for (c of comments(); track c.id) {
              <div class="comment">
                <div class="avatar sm">{{ c.author.username[0].toUpperCase() }}</div>
                <div class="comment-body">
                  <div class="comment-header">
                    <a [routerLink]="['/u', c.author.username]" class="commenter-name">
                      {{ c.author.display_name ?? c.author.username }}
                    </a>
                    <span class="comment-time">{{ timeAgo(c.created_at) }}</span>
                  </div>
                  <p class="comment-text">{{ c.body }}</p>
                </div>
              </div>
            } @empty {
              <p class="empty">Be the first to comment.</p>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 64px; }
    .page { padding: 16px; }

    .artist-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%; background: var(--color-accent-primary);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; flex-shrink: 0;
      &.sm { width: 28px; height: 28px; font-size: 12px; }
    }
    .artist-name { display: block; font-weight: 600; font-size: 14px; color: var(--color-text-primary); text-decoration: none;
      &:hover { color: var(--color-accent-primary); } }
    .date { font-size: 12px; color: var(--color-text-muted); }

    .track-title { margin: 0 0 10px; font-size: 22px; font-weight: 700; }
    .tag-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }

    /* Waveform player */
    .player-card {
      background: var(--color-bg-elevated); border-radius: var(--radius-card);
      padding: 12px; margin-bottom: 14px;
    }
    .waveform { height: 72px; cursor: pointer; }
    .player-controls { display: flex; align-items: center; gap: 8px; margin-top: 6px;
      button { color: var(--color-accent-primary) !important;
        mat-icon { font-size: 36px; width: 36px; height: 36px; } }
      .time { font-size: 13px; color: var(--color-text-secondary); }
    }

    /* Stats + actions */
    .actions-row { display: flex; align-items: center; gap: 16px; margin-bottom: 14px;
      .stat { display: flex; align-items: center; gap: 3px; font-size: 13px;
        color: var(--color-text-secondary);
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    .description { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px; }

    /* Similar tracks */
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: 700; margin: 0 0 10px; }
    .similar-list { display: flex; flex-direction: column; gap: 8px; }
    .similar-card { display: flex; align-items: center; justify-content: space-between; text-decoration: none; }
    .similar-info { min-width: 0; }
    .similar-title  { display: block; font-size: 14px; font-weight: 600; color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .similar-artist { font-size: 12px; color: var(--color-text-secondary); }
    .score-chip { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; flex-shrink: 0;
      background: rgba(124,58,237,.15); color: #7C3AED; }

    /* Comments */
    .comment-form { display: flex; gap: 10px; margin-bottom: 16px; align-items: flex-start; }
    .comment-input-wrap { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .comment-textarea {
      width: 100%; background: var(--color-bg-elevated); border: 1px solid var(--color-border);
      border-radius: 8px; color: var(--color-text-primary); padding: 10px; font-size: 14px;
      resize: none; font-family: inherit;
      &:focus { outline: none; border-color: var(--color-accent-primary); }
    }
    .comments-list { display: flex; flex-direction: column; gap: 14px; }
    .comment { display: flex; gap: 10px; }
    .comment-body { flex: 1; }
    .comment-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .commenter-name { font-weight: 600; font-size: 13px; color: var(--color-text-primary); text-decoration: none;
      &:hover { color: var(--color-accent-primary); } }
    .comment-time { font-size: 11px; color: var(--color-text-muted); }
    .comment-text  { margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.5; }
    .empty { color: var(--color-text-muted); font-size: 13px; }
  `],
})
export class TrackDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() id!: string;
  @ViewChild('waveformEl') waveformEl!: ElementRef;

  private api         = inject(ApiService);
  private playerStore = inject(PlayerStore);
  authStore           = inject(AuthStore);

  loading          = signal(true);
  track            = signal<Track | null>(null);
  comments         = signal<Comment[]>([]);
  similar          = signal<SimilarTrack[]>([]);
  isLiked          = signal(false);
  likeCount        = signal(0);
  submittingComment = signal(false);
  isPlaying        = signal(false);
  currentTime      = signal(0);
  commentControl   = new FormControl('', [Validators.required, Validators.minLength(1)]);

  private wavesurfer: any = null;

  ngOnInit() {
    this.api.get<Track>(`/tracks/${this.id}`).subscribe({
      next: t => {
        this.track.set(t);
        this.isLiked.set(t.is_liked);
        this.likeCount.set(t.like_count);
        this.loading.set(false);
        this.loadComments();
        this.loadSimilar();
      },
      error: () => this.loading.set(false),
    });
  }

  async ngAfterViewInit() {
    // WaveSurfer initialised after track loads (delayed init)
    const unwatch = setInterval(() => {
      if (this.track() && this.waveformEl) {
        clearInterval(unwatch);
        this.initWaveSurfer();
      }
    }, 100);
  }

  ngOnDestroy() { this.wavesurfer?.destroy(); }

  private async initWaveSurfer() {
    const { default: WaveSurfer } = await import('wavesurfer.js');
    this.wavesurfer = WaveSurfer.create({
      container: this.waveformEl.nativeElement,
      waveColor: '#334155', progressColor: '#7C3AED',
      cursorColor: '#F43F5E', height: 72,
      barWidth: 2, barGap: 1, barRadius: 2, normalize: true,
    });
    this.wavesurfer.on('timeupdate', (t: number) => this.currentTime.set(t));
    this.wavesurfer.on('play',  () => this.isPlaying.set(true));
    this.wavesurfer.on('pause', () => this.isPlaying.set(false));
    this.wavesurfer.on('finish', () => this.isPlaying.set(false));
    if (this.track()?.audio_url) {
      await this.wavesurfer.load(this.track()!.audio_url);
    }
  }

  togglePlay() {
    if (!this.wavesurfer) return;
    if (this.isPlaying()) this.wavesurfer.pause();
    else {
      this.wavesurfer.play();
      this.playerStore.play({
        id: this.track()!.id, title: this.track()!.title,
        audio_url: this.track()!.audio_url, waveform_url: this.track()!.waveform_url,
        artist: this.track()!.artist,
      });
    }
  }

  toggleLike() {
    const liked = this.isLiked();
    const op = liked
      ? this.api.delete(`/tracks/${this.id}/like`)
      : this.api.post(`/tracks/${this.id}/like`, {});
    op.subscribe(() => {
      this.isLiked.set(!liked);
      this.likeCount.update(n => liked ? n - 1 : n + 1);
    });
  }

  postComment() {
    const body = this.commentControl.value?.trim();
    if (!body) return;
    this.submittingComment.set(true);
    this.api.post<Comment>(`/tracks/${this.id}/comments`, { body }).subscribe({
      next: c => {
        this.comments.update(list => [c, ...list]);
        this.track.update(t => t ? { ...t, comment_count: t.comment_count + 1 } : t);
        this.commentControl.reset();
        this.submittingComment.set(false);
      },
      error: () => this.submittingComment.set(false),
    });
  }

  share() {
    if (navigator.share) {
      navigator.share({ title: this.track()!.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  loadComments() {
    this.api.get<Comment[]>(`/tracks/${this.id}/comments`).subscribe({
      next: list => this.comments.set(list),
    });
  }

  loadSimilar() {
    this.api.get<SimilarTrack[]>('/feed/search/similar', { track_id: this.id }).subscribe({
      next: list => this.similar.set(list),
    });
  }

  fpClass(status: string): string {
    if (status === 'done')    return 'unique';
    if (status === 'failed')  return 'pending';
    return 'pending';
  }
  fpLabel(status: string): string {
    return ({ pending: '🔄 Fingerprinting', done: '✅ Unique', failed: '⚠ Check failed' } as Record<string, string>)[status] ?? status;
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
}
