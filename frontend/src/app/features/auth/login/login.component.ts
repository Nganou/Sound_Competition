import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

interface DemoUser {
  label: string;
  email: string;
  password: string;
  icon: string;
  genre: string;
}

@Component({
  selector: 'sc-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, RouterLink],
  template: `
    <div class="sc-card">
      <h2>Sign in</h2>

      <!-- Demo quick-login section -->
      <div class="demo-section">
        <p class="demo-label">Try the demo — click to auto-login</p>
        <div class="demo-cards">
          @for (user of demoUsers; track user.email) {
            <button
              type="button"
              class="demo-card"
              [disabled]="loading"
              (click)="fillDemo(user)"
              [title]="'Login as ' + user.label"
            >
              <span class="demo-icon">{{ user.icon }}</span>
              <span class="demo-name">{{ user.label }}</span>
              <span class="demo-genre">{{ user.genre }}</span>
            </button>
          }
        </div>
      </div>

      <div class="or-divider"><span>or sign in with your account</span></div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="current-password">
        </mat-form-field>

        @if (error) {
          <p class="error">{{ error }}</p>
        }

        <button mat-flat-button color="primary" type="submit" [disabled]="loading || form.invalid">
          @if (loading) { <mat-spinner diameter="20" /> } @else { Sign in }
        </button>

        <p class="link">Don't have an account? <a routerLink="/auth/register">Register</a></p>
      </form>
    </div>
  `,
  styles: [`
    h2 { margin: 0 0 20px; font-size: 20px; font-weight: 700; }
    .form { display: flex; flex-direction: column; gap: 12px; }
    mat-form-field { width: 100%; }
    button[mat-flat-button] { height: 48px; }
    .error { color: var(--color-accent-hot); font-size: 13px; margin: 0; }
    .link {
      text-align: center; font-size: 13px; color: var(--color-text-secondary);
      a { color: var(--color-accent-primary); text-decoration: none; font-weight: 600; }
    }

    /* Demo cards */
    .demo-section { margin-bottom: 4px; }
    .demo-label {
      font-size: 12px; color: var(--color-text-secondary);
      text-align: center; margin: 0 0 10px; letter-spacing: 0.02em;
    }
    .demo-cards { display: flex; gap: 8px; }
    .demo-card {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      gap: 4px; padding: 12px 6px; border-radius: 12px;
      border: 1px solid rgba(124,58,237,0.25);
      background: rgba(124,58,237,0.06);
      cursor: pointer; transition: border-color 0.2s, background 0.2s;
      color: var(--color-text-primary);
    }
    .demo-card:hover:not(:disabled) {
      border-color: var(--color-accent-primary);
      background: rgba(124,58,237,0.14);
    }
    .demo-card:disabled { opacity: 0.5; cursor: not-allowed; }
    .demo-icon { font-size: 22px; line-height: 1; }
    .demo-name { font-size: 11px; font-weight: 700; white-space: nowrap; }
    .demo-genre { font-size: 10px; color: var(--color-text-secondary); white-space: nowrap; }

    /* Divider */
    .or-divider {
      display: flex; align-items: center; gap: 10px;
      margin: 16px 0; color: var(--color-text-secondary); font-size: 12px;
    }
    .or-divider::before, .or-divider::after {
      content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1);
    }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  loading = false;
  error = '';

  demoUsers: DemoUser[] = [
    { label: 'Beat Master', email: 'beatmaster@demo.com', password: 'demo1234', icon: '🎛️', genre: 'Trap / Hip-Hop' },
    { label: 'Lo-Fi Luna', email: 'luna@demo.com', password: 'demo1234', icon: '🌙', genre: 'Lo-Fi / Jazz' },
    { label: 'Bass Line King', email: 'bass@demo.com', password: 'demo1234', icon: '🎸', genre: 'DnB / Electronic' },
  ];

  fillDemo(user: DemoUser): void {
    this.form.setValue({ email: user.email, password: user.password });
    this.submit();
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;
    this.auth.login({ email: email!, password: password! }).subscribe({
      next: () => this.router.navigate(['/feed']),
      error: (err) => {
        this.error = err.error?.detail ?? 'Invalid email or password';
        this.loading = false;
      },
    });
  }
}
