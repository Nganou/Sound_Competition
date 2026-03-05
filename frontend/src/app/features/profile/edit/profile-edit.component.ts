import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStore } from '../../../core/store/auth.store';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string;
  location: string;
  avatar_url: string | null;
  is_verified: boolean;
}

@Component({
  selector: 'sc-profile-edit',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <a routerLink="/u/me" class="back-btn">
          <span class="material-symbols-outlined">arrow_back</span>
        </a>
        <h1 class="page-title">Edit Profile</h1>
        <div class="header-spacer"></div>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="edit-form">
          <!-- Avatar section -->
          <div class="avatar-section">
            <div class="avatar-wrapper">
              @if (avatarPreview()) {
                <img [src]="avatarPreview()" alt="Avatar" class="avatar-img" />
              } @else if (currentUser()?.avatar_url) {
                <img [src]="currentUser()!.avatar_url!" alt="Avatar" class="avatar-img" />
              } @else {
                <div class="avatar-placeholder">
                  {{ (currentUser()?.display_name || 'U')[0].toUpperCase() }}
                </div>
              }
              <label class="avatar-edit-btn" for="avatarInput">
                <span class="material-symbols-outlined">photo_camera</span>
              </label>
            </div>
            <input
              type="file"
              id="avatarInput"
              accept="image/*"
              class="hidden-input"
              (change)="onAvatarSelect($event)"
            />
            @if (avatarFile()) {
              <div class="avatar-actions">
                <button type="button" class="btn-secondary btn-sm" (click)="uploadAvatar()" [disabled]="uploadingAvatar()">
                  {{ uploadingAvatar() ? 'Uploading…' : 'Save Photo' }}
                </button>
                <button type="button" class="btn-ghost btn-sm" (click)="clearAvatarSelection()">Cancel</button>
              </div>
            }
          </div>

          <!-- Form fields -->
          <div class="form-section">
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input
                type="text"
                formControlName="display_name"
                class="form-input"
                placeholder="Your name"
                maxlength="100"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Username</label>
              <div class="input-prefix-wrapper">
                <span class="input-prefix">&#64;</span>
                <input
                  type="text"
                  formControlName="username"
                  class="form-input prefixed"
                  placeholder="username"
                  maxlength="50"
                />
              </div>
              @if (form.get('username')?.errors?.['minlength']) {
                <span class="field-error">At least 3 characters</span>
              }
              @if (form.get('username')?.errors?.['pattern']) {
                <span class="field-error">Letters, numbers, and underscores only</span>
              }
            </div>

            <div class="form-group">
              <label class="form-label">Bio</label>
              <textarea
                formControlName="bio"
                class="form-input textarea"
                placeholder="Tell the community about your sound..."
                rows="4"
                maxlength="500"
              ></textarea>
              <span class="char-count">{{ form.get('bio')?.value?.length || 0 }}/500</span>
            </div>

            <div class="form-group">
              <label class="form-label">Location</label>
              <input
                type="text"
                formControlName="location"
                class="form-input"
                placeholder="City, Country"
                maxlength="100"
              />
            </div>
          </div>

          <!-- Password section -->
          <div class="section-divider">
            <span class="section-label">Change Password</span>
          </div>
          <div class="form-section">
            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input
                type="password"
                formControlName="current_password"
                class="form-input"
                placeholder="Enter current password"
                autocomplete="current-password"
              />
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input
                type="password"
                formControlName="new_password"
                class="form-input"
                placeholder="At least 8 characters"
                autocomplete="new-password"
              />
              @if (form.get('new_password')?.errors?.['minlength']) {
                <span class="field-error">At least 8 characters</span>
              }
            </div>
          </div>

          @if (errorMsg()) {
            <div class="error-banner">{{ errorMsg() }}</div>
          }
          @if (successMsg()) {
            <div class="success-banner">{{ successMsg() }}</div>
          }

          <div class="form-actions">
            <a routerLink="/u/me" class="btn-secondary">Cancel</a>
            <button type="submit" class="btn-primary" [disabled]="saving() || form.invalid">
              {{ saving() ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 540px; margin: 0 auto; padding: 0 0 80px; }
    .page-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px; position: sticky; top: 0;
      background: var(--color-bg-primary); z-index: 10;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .back-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--color-bg-surface); color: var(--color-text-primary);
      text-decoration: none;
    }
    .page-title { font-size: 18px; font-weight: 600; flex: 1; }
    .header-spacer { width: 36px; }
    .loading-state { display: flex; justify-content: center; padding: 48px; }
    .spinner {
      width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
      border-top-color: var(--color-accent-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .avatar-section {
      display: flex; flex-direction: column; align-items: center;
      padding: 24px 16px; gap: 12px;
    }
    .avatar-wrapper { position: relative; }
    .avatar-img, .avatar-placeholder {
      width: 96px; height: 96px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .avatar-img { object-fit: cover; }
    .avatar-placeholder {
      background: var(--color-accent-primary);
      font-size: 36px; font-weight: 700; color: #fff;
    }
    .avatar-edit-btn {
      position: absolute; bottom: 0; right: 0;
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--color-accent-primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .avatar-edit-btn .material-symbols-outlined { font-size: 16px; }
    .avatar-actions { display: flex; gap: 8px; }
    .hidden-input { display: none; }

    .form-section { padding: 0 16px; }
    .form-group { margin-bottom: 20px; }
    .form-label {
      display: block; font-size: 13px; font-weight: 500;
      color: var(--color-text-secondary); margin-bottom: 6px;
    }
    .form-input {
      width: 100%; padding: 12px 14px; border-radius: 10px;
      background: var(--color-bg-surface); color: var(--color-text-primary);
      border: 1px solid rgba(255,255,255,0.1); font-size: 15px;
      outline: none; box-sizing: border-box; transition: border-color 0.2s;
    }
    .form-input:focus { border-color: var(--color-accent-primary); }
    .form-input.textarea { resize: vertical; min-height: 100px; font-family: inherit; }
    .input-prefix-wrapper { position: relative; }
    .input-prefix {
      position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
      color: var(--color-text-secondary); font-size: 15px;
    }
    .form-input.prefixed { padding-left: 28px; }
    .char-count {
      display: block; text-align: right; font-size: 12px;
      color: var(--color-text-secondary); margin-top: 4px;
    }
    .field-error { display: block; color: var(--color-accent-hot); font-size: 12px; margin-top: 4px; }

    .section-divider {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 16px 16px;
    }
    .section-label {
      font-size: 13px; font-weight: 600;
      color: var(--color-text-secondary); white-space: nowrap;
    }
    .section-divider::before, .section-divider::after {
      content: ''; flex: 1; height: 1px;
      background: rgba(255,255,255,0.1);
    }

    .error-banner {
      margin: 0 16px 16px; padding: 12px; border-radius: 8px;
      background: rgba(244,63,94,0.1); color: var(--color-accent-hot);
      border: 1px solid rgba(244,63,94,0.3); font-size: 14px;
    }
    .success-banner {
      margin: 0 16px 16px; padding: 12px; border-radius: 8px;
      background: rgba(52,211,153,0.1); color: #34d399;
      border: 1px solid rgba(52,211,153,0.3); font-size: 14px;
    }
    .form-actions {
      display: flex; gap: 12px; padding: 16px;
      justify-content: flex-end;
    }
    .btn-primary {
      padding: 12px 24px; border-radius: 10px; border: none;
      background: var(--color-accent-primary); color: #fff;
      font-size: 15px; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      padding: 12px 24px; border-radius: 10px;
      background: var(--color-bg-surface); color: var(--color-text-primary);
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 15px; font-weight: 500; cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center;
    }
    .btn-ghost {
      padding: 8px 16px; border-radius: 8px; border: none;
      background: transparent; color: var(--color-text-secondary);
      font-size: 14px; cursor: pointer;
    }
    .btn-sm { padding: 8px 16px; font-size: 14px; }
  `]
})
export class ProfileEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  readonly authStore = inject(AuthStore);

  currentUser = this.authStore.user;
  loading = signal(true);
  saving = signal(false);
  uploadingAvatar = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
  avatarPreview = signal<string | null>(null);
  avatarFile = signal<File | null>(null);

  form = this.fb.group({
    display_name: ['', Validators.required],
    username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
    bio: [''],
    location: [''],
    current_password: [''],
    new_password: ['', Validators.minLength(8)],
  });

  ngOnInit() {
    this.api.get<UserProfile>('/users/me').subscribe({
      next: (user) => {
        this.form.patchValue({
          display_name: user.display_name,
          username: user.username,
          bio: user.bio || '',
          location: user.location || '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onAvatarSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => this.avatarPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  clearAvatarSelection() {
    this.avatarFile.set(null);
    this.avatarPreview.set(null);
  }

  uploadAvatar() {
    const file = this.avatarFile();
    if (!file) return;
    this.uploadingAvatar.set(true);
    const formData = new FormData();
    formData.append('file', file);
    this.api.post<{ avatar_url: string }>('/users/me/avatar', formData).subscribe({
      next: () => {
        this.uploadingAvatar.set(false);
        this.avatarFile.set(null);
        this.authStore.loadCurrentUser();
        this.successMsg.set('Avatar updated!');
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: () => {
        this.uploadingAvatar.set(false);
        this.errorMsg.set('Avatar upload failed.');
      },
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');
    const { current_password, new_password, ...profileData } = this.form.value;
    const payload: Record<string, unknown> = { ...profileData };
    if (new_password && current_password) {
      payload['current_password'] = current_password;
      payload['new_password'] = new_password;
    }
    this.api.put<UserProfile>('/users/me', payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.authStore.loadCurrentUser();
        this.successMsg.set('Profile saved!');
        setTimeout(() => this.router.navigate(['/u/me']), 1200);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.detail || 'Failed to save profile.');
      },
    });
  }
}
