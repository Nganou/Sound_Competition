import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'sc-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, RouterLink],
  template: `
    <div class="sc-card">
      <h2>Sign in</h2>
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
    h2 { margin: 0 0 24px; font-size: 20px; font-weight: 700; }
    .form { display: flex; flex-direction: column; gap: 12px; }
    mat-form-field { width: 100%; }
    button { height: 48px; }
    .error { color: var(--color-accent-hot); font-size: 13px; margin: 0; }
    .link { text-align: center; font-size: 13px; color: var(--color-text-secondary);
      a { color: var(--color-accent-primary); text-decoration: none; font-weight: 600; } }
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
