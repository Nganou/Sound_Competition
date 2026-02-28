import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { AsyncPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { inject as coreInject } from '@angular/core';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'sc-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatBadgeModule],
  template: `
    <nav class="bottom-nav">
      @for (item of items; track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.route === '/feed' }"
          class="bottom-nav__item"
          [class.upload]="item.icon === 'add_circle'"
        >
          <mat-icon [class.upload-icon]="item.icon === 'add_circle'">{{ item.icon }}</mat-icon>
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: [`
    .bottom-nav {
      display: flex;
      height: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
      padding-bottom: var(--safe-area-bottom);
      background: var(--color-bg-elevated);
      border-top: 1px solid var(--color-border);
      align-items: center;
    }
    .bottom-nav__item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-decoration: none;
      color: var(--color-text-muted);
      font-size: 10px;
      font-weight: 500;
      transition: color 0.15s;
      padding: 8px 0;

      &.active { color: var(--color-accent-primary); }
      &.upload mat-icon { color: var(--color-accent-primary); font-size: 32px; width: 32px; height: 32px; }
    }
    .upload-icon { transform: scale(1.4); }
  `],
})
export class BottomNavComponent {
  items: NavItem[] = [
    { icon: 'home',        label: 'Feed',     route: '/feed' },
    { icon: 'search',      label: 'Search',   route: '/search' },
    { icon: 'add_circle',  label: 'Upload',   route: '/upload' },
    { icon: 'sports_mma',  label: 'Battles',  route: '/tournaments' },
    { icon: 'person',      label: 'Profile',  route: '/u/me/edit' },
  ];
}
