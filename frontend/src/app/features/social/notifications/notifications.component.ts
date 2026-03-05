import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

@Component({
  selector: 'sc-notifications',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Notifications</h1>
        @if (unreadCount() > 0) {
          <button class="mark-all-btn" (click)="markAllRead()">Mark all read</button>
        }
      </div>

      @if (loading()) {
        <div class="loading-state">
          @for (_ of [1,2,3,4,5]; track $index) {
            <div class="notif-skeleton"></div>
          }
        </div>
      } @else if (notifications().length === 0) {
        <div class="empty-state">
          <span class="material-symbols-outlined empty-icon">notifications_none</span>
          <p class="empty-title">All caught up</p>
          <p class="empty-sub">When someone follows you, likes your track, or invites you to battle — it'll show up here.</p>
        </div>
      } @else {
        <div class="notif-list">
          @for (notif of notifications(); track notif.id) {
            <div
              class="notif-item"
              [class.unread]="!notif.is_read"
              (click)="handleClick(notif)"
            >
              <div class="notif-icon" [attr.data-type]="notif.type">
                <span class="material-symbols-outlined">{{ iconFor(notif.type) }}</span>
              </div>
              <div class="notif-body">
                <p class="notif-text" [innerHTML]="textFor(notif)"></p>
                <span class="notif-time">{{ notif.created_at | date:'short' }}</span>
              </div>
              @if (!notif.is_read) {
                <div class="unread-dot"></div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 600px; margin: 0 auto; padding: 0 0 80px; }
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px; position: sticky; top: 0;
      background: var(--color-bg-primary); z-index: 10;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .page-title { font-size: 20px; font-weight: 700; }
    .mark-all-btn {
      background: none; border: none; cursor: pointer;
      color: var(--color-accent-primary); font-size: 14px; font-weight: 500;
    }
    .loading-state { padding: 8px 0; }
    .notif-skeleton {
      height: 70px; background: var(--color-bg-surface);
      border-radius: 12px; margin: 4px 12px;
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 24px; gap: 8px; text-align: center;
    }
    .empty-icon { font-size: 56px; color: var(--color-text-secondary); opacity: 0.4; }
    .empty-title { font-size: 18px; font-weight: 600; }
    .empty-sub { color: var(--color-text-secondary); font-size: 14px; max-width: 280px; line-height: 1.5; }
    .notif-list { padding: 4px 0; }
    .notif-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; cursor: pointer; transition: background 0.15s;
      position: relative;
    }
    .notif-item:hover { background: var(--color-bg-surface); }
    .notif-item.unread { background: rgba(124,58,237,0.05); }
    .notif-icon {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-bg-elevated);
    }
    .notif-icon[data-type="new_follower"] { background: rgba(124,58,237,0.2); color: var(--color-accent-primary); }
    .notif-icon[data-type="track_liked"] { background: rgba(244,63,94,0.2); color: var(--color-accent-hot); }
    .notif-icon[data-type="battle_started"] { background: rgba(245,158,11,0.2); color: var(--color-accent-gold); }
    .notif-icon[data-type="collab_request"] { background: rgba(52,211,153,0.2); color: #34d399; }
    .notif-icon[data-type="comment_added"] { background: rgba(96,165,250,0.2); color: #60a5fa; }
    .notif-icon[data-type="similarity_flag"] { background: rgba(251,146,60,0.2); color: #fb923c; }
    .notif-icon .material-symbols-outlined { font-size: 20px; }
    .notif-body { flex: 1; min-width: 0; }
    .notif-text { font-size: 14px; line-height: 1.4; margin: 0 0 4px; }
    .notif-time { font-size: 12px; color: var(--color-text-secondary); }
    .unread-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-accent-primary); flex-shrink: 0;
      align-self: center;
    }
  `]
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);

  notifications = signal<Notification[]>([]);
  loading = signal(true);
  unreadCount = computed(() => this.notifications().filter(n => !n.is_read).length);

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.get<Notification[]>('/social/notifications').subscribe({
      next: (items) => {
        this.notifications.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markAllRead() {
    this.api.post('/social/notifications/read-all', {}).subscribe(() => {
      this.notifications.update(items => items.map(n => ({ ...n, is_read: true })));
    });
  }

  markRead(id: string) {
    this.api.post(`/social/notifications/${id}/read`, {}).subscribe(() => {
      this.notifications.update(items =>
        items.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    });
  }

  handleClick(notif: Notification) {
    if (!notif.is_read) this.markRead(notif.id);
  }

  iconFor(type: string): string {
    const map: Record<string, string> = {
      new_follower: 'person_add',
      track_liked: 'favorite',
      battle_started: 'sports_mma',
      collab_request: 'handshake',
      comment_added: 'chat_bubble',
      similarity_flag: 'warning',
      match_result: 'emoji_events',
    };
    return map[type] ?? 'notifications';
  }

  textFor(notif: Notification): string {
    const p = notif.payload as Record<string, string>;
    const actor = p['actor_username'] ? `<strong>@${p['actor_username']}</strong>` : 'Someone';
    switch (notif.type) {
      case 'new_follower': return `${actor} started following you`;
      case 'track_liked': return `${actor} liked your track <em>${p['track_title'] ?? ''}</em>`;
      case 'battle_started': return `Your battle in <em>${p['tournament_title'] ?? ''}</em> has started`;
      case 'collab_request': return `${actor} sent you a collaboration request`;
      case 'comment_added': return `${actor} commented on <em>${p['track_title'] ?? 'your track'}</em>`;
      case 'similarity_flag': return `Your track <em>${p['track_title'] ?? ''}</em> was flagged as similar to another upload`;
      case 'match_result': return `Match result recorded — you ${p['outcome'] ?? ''} in round ${p['round'] ?? ''}`;
      default: return 'You have a new notification';
    }
  }
}
