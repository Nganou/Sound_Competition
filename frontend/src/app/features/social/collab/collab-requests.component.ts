import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthStore } from '../../../core/store/auth.store';

interface CollabRequest {
  id: string;
  requester: { id: string; username: string; display_name: string; avatar_url: string | null };
  recipient: { id: string; username: string; display_name: string; avatar_url: string | null };
  track?: { id: string; title: string };
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

@Component({
  selector: 'sc-collab-requests',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Collaborations</h1>
      </div>

      <!-- Tabs -->
      <div class="tab-bar">
        <button
          class="tab-btn"
          [class.active]="activeTab() === 'received'"
          (click)="activeTab.set('received'); loadReceived()"
        >
          Received
          @if (pendingCount() > 0) {
            <span class="badge">{{ pendingCount() }}</span>
          }
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab() === 'sent'"
          (click)="activeTab.set('sent'); loadSent()"
        >
          Sent
        </button>
      </div>

      <!-- Content -->
      @if (loading()) {
        <div class="loading-list">
          @for (_ of [1,2,3]; track $index) {
            <div class="collab-skeleton"></div>
          }
        </div>
      } @else {
        <div class="collab-list">
          @if (activeList().length === 0) {
            <div class="empty-state">
              <span class="material-symbols-outlined empty-icon">handshake</span>
              <p class="empty-title">No {{ activeTab() }} requests</p>
              <p class="empty-sub">
                @if (activeTab() === 'received') {
                  When other artists want to collaborate with you, requests will appear here.
                } @else {
                  You haven't sent any collaboration requests yet.
                }
              </p>
            </div>
          }
          @for (req of activeList(); track req.id) {
            <div class="collab-card sc-card">
              <!-- Requester / recipient info -->
              <div class="collab-header">
                <a [routerLink]="['/u', otherParty(req).username]" class="user-link">
                  @if (otherParty(req).avatar_url) {
                    <img [src]="otherParty(req).avatar_url!" [alt]="otherParty(req).display_name" class="avatar-sm" />
                  } @else {
                    <div class="avatar-sm avatar-placeholder">
                      {{ otherParty(req).display_name[0].toUpperCase() }}
                    </div>
                  }
                  <div>
                    <span class="user-name">{{ otherParty(req).display_name }}</span>
                    <span class="user-handle">@{{ otherParty(req).username }}</span>
                  </div>
                </a>
                <span class="status-chip" [attr.data-status]="req.status">
                  {{ req.status }}
                </span>
              </div>

              @if (req.track) {
                <div class="track-ref">
                  <span class="material-symbols-outlined">music_note</span>
                  <a [routerLink]="['/tracks', req.track.id]" class="track-link">{{ req.track.title }}</a>
                </div>
              }

              @if (req.message) {
                <p class="collab-message">"{{ req.message }}"</p>
              }

              <div class="collab-footer">
                <span class="collab-time">{{ req.created_at | date:'mediumDate' }}</span>
                @if (activeTab() === 'received' && req.status === 'pending') {
                  <div class="action-btns">
                    <button class="btn-decline" (click)="respond(req.id, 'decline')">Decline</button>
                    <button class="btn-accept" (click)="respond(req.id, 'accept')">Accept</button>
                  </div>
                }
                @if (activeTab() === 'sent' && req.status === 'pending') {
                  <button class="btn-cancel" (click)="cancel(req.id)">Cancel</button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 600px; margin: 0 auto; padding: 0 0 80px; }
    .page-header {
      padding: 16px; position: sticky; top: 0;
      background: var(--color-bg-primary); z-index: 10;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .page-title { font-size: 20px; font-weight: 700; }
    .tab-bar {
      display: flex; border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0 16px; gap: 4px;
    }
    .tab-btn {
      background: none; border: none; padding: 12px 16px;
      color: var(--color-text-secondary); font-size: 14px; font-weight: 500;
      cursor: pointer; position: relative; display: flex; align-items: center; gap: 6px;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tab-btn.active {
      color: var(--color-accent-primary);
      border-bottom-color: var(--color-accent-primary);
    }
    .badge {
      background: var(--color-accent-hot); color: #fff;
      border-radius: 10px; padding: 1px 6px; font-size: 11px; font-weight: 700;
    }
    .loading-list { padding: 8px 16px; }
    .collab-skeleton {
      height: 130px; background: var(--color-bg-surface); border-radius: 12px;
      margin-bottom: 8px; animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 24px; gap: 8px; text-align: center;
    }
    .empty-icon { font-size: 56px; color: var(--color-text-secondary); opacity: 0.4; }
    .empty-title { font-size: 18px; font-weight: 600; }
    .empty-sub { color: var(--color-text-secondary); font-size: 14px; max-width: 280px; line-height: 1.5; }
    .collab-list { padding: 8px 16px; display: flex; flex-direction: column; gap: 8px; }
    .collab-card { padding: 16px; }
    .collab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .user-link { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .avatar-sm { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .avatar-placeholder {
      background: var(--color-accent-primary); color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 700;
    }
    .user-name { display: block; font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
    .user-handle { display: block; font-size: 12px; color: var(--color-text-secondary); }
    .status-chip {
      padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
    }
    .status-chip[data-status="pending"] { background: rgba(245,158,11,0.15); color: var(--color-accent-gold); }
    .status-chip[data-status="accepted"] { background: rgba(52,211,153,0.15); color: #34d399; }
    .status-chip[data-status="declined"] { background: rgba(148,163,184,0.15); color: var(--color-text-secondary); }
    .track-ref {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px;
    }
    .track-ref .material-symbols-outlined { font-size: 16px; }
    .track-link { color: var(--color-accent-primary); text-decoration: none; }
    .collab-message {
      font-size: 14px; color: var(--color-text-secondary);
      font-style: italic; margin: 0 0 12px; line-height: 1.5;
    }
    .collab-footer { display: flex; align-items: center; justify-content: space-between; }
    .collab-time { font-size: 12px; color: var(--color-text-secondary); }
    .action-btns { display: flex; gap: 8px; }
    .btn-accept {
      padding: 8px 20px; border-radius: 8px; border: none;
      background: var(--color-accent-primary); color: #fff;
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-decline {
      padding: 8px 20px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1); background: transparent;
      color: var(--color-text-secondary); font-size: 13px; cursor: pointer;
    }
    .btn-cancel {
      padding: 6px 14px; border-radius: 8px;
      border: 1px solid rgba(244,63,94,0.3);
      background: rgba(244,63,94,0.08); color: var(--color-accent-hot);
      font-size: 13px; cursor: pointer;
    }
  `]
})
export class CollabRequestsComponent implements OnInit {
  private api = inject(ApiService);
  readonly authStore = inject(AuthStore);

  activeTab = signal<'received' | 'sent'>('received');
  loading = signal(true);
  received = signal<CollabRequest[]>([]);
  sent = signal<CollabRequest[]>([]);

  activeList = () => this.activeTab() === 'received' ? this.received() : this.sent();
  pendingCount = () => this.received().filter(r => r.status === 'pending').length;

  ngOnInit() {
    this.loadReceived();
  }

  loadReceived() {
    this.loading.set(true);
    this.api.get<CollabRequest[]>('/social/collab?direction=received').subscribe({
      next: (items) => { this.received.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadSent() {
    this.loading.set(true);
    this.api.get<CollabRequest[]>('/social/collab?direction=sent').subscribe({
      next: (items) => { this.sent.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  otherParty(req: CollabRequest) {
    const me = this.authStore.user();
    return me?.id === req.requester.id ? req.recipient : req.requester;
  }

  respond(id: string, action: 'accept' | 'decline') {
    this.api.post(`/social/collab/${id}/${action}`, {}).subscribe(() => {
      const status = action === 'accept' ? 'accepted' : 'declined';
      this.received.update(items =>
        items.map(r => r.id === id ? { ...r, status: status as CollabRequest['status'] } : r)
      );
    });
  }

  cancel(id: string) {
    this.api.delete(`/social/collab/${id}`).subscribe(() => {
      this.sent.update(items => items.filter(r => r.id !== id));
    });
  }
}
