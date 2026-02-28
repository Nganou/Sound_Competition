import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/store/auth.store';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { AudioPlayerComponent } from '../../shared/components/audio-player/audio-player.component';

@Component({
  selector: 'sc-shell',
  standalone: true,
  imports: [RouterOutlet, BottomNavComponent, AudioPlayerComponent],
  template: `
    <div class="shell">
      <main class="shell__content">
        <router-outlet />
      </main>
      <sc-audio-player class="shell__player" />
      <sc-bottom-nav class="shell__nav" />
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
    }
    .shell__content {
      flex: 1;
      overflow-y: auto;
      padding-bottom: calc(var(--bottom-nav-height) + 80px + var(--safe-area-bottom));
    }
    .shell__player {
      position: fixed;
      bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
      left: 0; right: 0;
      z-index: 100;
    }
    .shell__nav {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 101;
    }
  `],
})
export class ShellComponent implements OnInit {
  private authStore = inject(AuthStore);

  ngOnInit() {
    this.authStore.loadCurrentUser();
  }
}
