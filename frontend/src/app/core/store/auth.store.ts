import { Injectable, inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_verified: boolean;
  created_at: string;
}

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ user: null, isLoading: false }),
  withMethods((store, http = inject(HttpClient)) => ({
    loadCurrentUser() {
      patchState(store, { isLoading: true });
      http.get<UserProfile>('/api/v1/users/me').subscribe({
        next: user => patchState(store, { user, isLoading: false }),
        error: ()  => patchState(store, { user: null, isLoading: false }),
      });
    },
    clearUser() {
      patchState(store, { user: null });
    },
  }))
);
