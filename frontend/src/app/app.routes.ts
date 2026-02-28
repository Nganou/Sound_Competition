import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  // Auth layout (unauthenticated)
  {
    path: 'auth',
    loadComponent: () => import('./layout/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      { path: 'login',    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  // App shell (authenticated)
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '',          redirectTo: 'feed', pathMatch: 'full' },
      { path: 'feed',      loadComponent: () => import('./features/feed/feed.component').then(m => m.FeedComponent) },
      { path: 'search',    loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent) },
      { path: 'upload',    loadComponent: () => import('./features/tracks/upload/upload.component').then(m => m.UploadComponent) },
      { path: 'tracks/:id', loadComponent: () => import('./features/tracks/detail/track-detail.component').then(m => m.TrackDetailComponent) },
      {
        path: 'tournaments',
        children: [
          { path: '',    loadComponent: () => import('./features/tournaments/list/tournament-list.component').then(m => m.TournamentListComponent) },
          { path: 'new', loadComponent: () => import('./features/tournaments/create/tournament-create.component').then(m => m.TournamentCreateComponent) },
          { path: ':id', loadComponent: () => import('./features/tournaments/detail/tournament-detail.component').then(m => m.TournamentDetailComponent) },
        ],
      },
      { path: 'battles/:id',    loadComponent: () => import('./features/battles/battle-view.component').then(m => m.BattleViewComponent) },
      { path: 'notifications',  loadComponent: () => import('./features/social/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'collab',         loadComponent: () => import('./features/social/collab/collab-requests.component').then(m => m.CollabRequestsComponent) },
      { path: 'u/me/edit',      loadComponent: () => import('./features/profile/edit/profile-edit.component').then(m => m.ProfileEditComponent) },
      { path: 'u/:username',    loadComponent: () => import('./features/profile/view/profile-view.component').then(m => m.ProfileViewComponent) },
    ],
  },

  { path: '**', redirectTo: '/feed' },
];
