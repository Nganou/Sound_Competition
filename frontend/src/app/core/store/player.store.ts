import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

export interface Track {
  id: string;
  title: string;
  audio_url: string;
  waveform_url: string | null;
  artist: { username: string; display_name: string | null };
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export const PlayerStore = signalStore(
  { providedIn: 'root' },
  withState<PlayerState>({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  }),
  withMethods(store => ({
    play(track: Track) {
      patchState(store, { currentTrack: track, isPlaying: true });
    },
    pause() {
      patchState(store, { isPlaying: false });
    },
    resume() {
      patchState(store, { isPlaying: true });
    },
    setQueue(tracks: Track[]) {
      patchState(store, { queue: tracks });
    },
    updateTime(currentTime: number, duration: number) {
      patchState(store, { currentTime, duration });
    },
    playNext() {
      const queue = store.queue();
      const current = store.currentTrack();
      if (!queue.length || !current) return;
      const idx = queue.findIndex(t => t.id === current.id);
      const next = queue[idx + 1];
      if (next) patchState(store, { currentTrack: next, isPlaying: true });
    },
  }))
);
