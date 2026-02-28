import {
  Component, ElementRef, ViewChild, AfterViewInit,
  OnDestroy, inject, effect,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PlayerStore } from '../../../core/store/player.store';

@Component({
  selector: 'sc-audio-player',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    @if (playerStore.currentTrack(); as track) {
      <div class="player">
        <div class="player__waveform" #waveformContainer></div>
        <div class="player__controls">
          <div class="player__info">
            <span class="player__title">{{ track.title }}</span>
            <span class="player__artist">{{ track.artist.display_name ?? track.artist.username }}</span>
          </div>
          <div class="player__actions">
            <button mat-icon-button (click)="playPrev()"><mat-icon>skip_previous</mat-icon></button>
            <button mat-icon-button class="play-btn" (click)="togglePlay()">
              <mat-icon>{{ playerStore.isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
            </button>
            <button mat-icon-button (click)="playerStore.playNext()"><mat-icon>skip_next</mat-icon></button>
          </div>
          <span class="player__time">{{ formatTime(playerStore.currentTime()) }}</span>
        </div>
      </div>
    }
  `,
  styles: [`
    .player {
      background: var(--color-bg-elevated);
      border-top: 1px solid var(--color-border);
      padding: 8px 16px 4px;
    }
    .player__waveform { width: 100%; height: 40px; cursor: pointer; }
    .player__controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .player__info {
      flex: 1;
      min-width: 0;
      .player__title  { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .player__artist { display: block; font-size: 11px; color: var(--color-text-secondary); }
    }
    .player__actions { display: flex; align-items: center; }
    .play-btn { color: var(--color-accent-primary) !important; }
    .player__time { font-size: 11px; color: var(--color-text-muted); white-space: nowrap; }
  `],
})
export class AudioPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('waveformContainer') waveformRef!: ElementRef;
  playerStore = inject(PlayerStore);
  private wavesurfer: any = null;

  constructor() {
    // React to track changes
    effect(() => {
      const track = this.playerStore.currentTrack();
      if (track && this.waveformRef) {
        this._loadTrack(track);
      }
    });

    effect(() => {
      const playing = this.playerStore.isPlaying();
      if (!this.wavesurfer) return;
      if (playing) this.wavesurfer.play();
      else this.wavesurfer.pause();
    });
  }

  async ngAfterViewInit() {
    const { default: WaveSurfer } = await import('wavesurfer.js');
    this.wavesurfer = WaveSurfer.create({
      container: this.waveformRef.nativeElement,
      waveColor: '#475569',
      progressColor: '#7C3AED',
      cursorColor: '#F43F5E',
      height: 40,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
    });

    this.wavesurfer.on('timeupdate', (time: number) =>
      this.playerStore.updateTime(time, this.wavesurfer.getDuration())
    );
    this.wavesurfer.on('finish', () => this.playerStore.playNext());

    const track = this.playerStore.currentTrack();
    if (track) this._loadTrack(track);
  }

  ngOnDestroy() {
    this.wavesurfer?.destroy();
  }

  togglePlay() {
    if (this.playerStore.isPlaying()) this.playerStore.pause();
    else this.playerStore.resume();
  }

  playPrev() { /* TODO: implement previous track */ }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private async _loadTrack(track: { audio_url: string }) {
    if (!this.wavesurfer) return;
    await this.wavesurfer.load(track.audio_url);
    if (this.playerStore.isPlaying()) this.wavesurfer.play();
  }
}
