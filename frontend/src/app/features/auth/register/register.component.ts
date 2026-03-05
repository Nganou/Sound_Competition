import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'sc-register',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, RouterLink],
  template: `
    <div class="sc-card">
      <h2>Create account</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Username</mat-label>
          <input matInput formControlName="username" autocomplete="username">
          @if (form.get('username')?.errors?.['minlength']) {
            <mat-error>Minimum 3 characters</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Display name (optional)</mat-label>
          <input matInput formControlName="display_name">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password">
          @if (form.get('password')?.errors?.['minlength']) {
            <mat-error>Minimum 8 characters</mat-error>
          }
        </mat-form-field>

        @if (error) {
          <p class="error">{{ error }}</p>
        }

        <button mat-flat-button color="primary" type="submit" [disabled]="loading || form.invalid">
          @if (loading) { <mat-spinner diameter="20" /> } @else { Create account }
        </button>

        <p class="link">Already have an account? <a routerLink="/auth/login">Sign in</a></p>
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
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    username:     ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    email:        ['', [Validators.required, Validators.email]],
    display_name: [''],
    password:     ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = false;
  error = '';

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const v = this.form.value;
    this.auth.register({
      username: v.username!,
      email: v.email!,
      password: v.password!,
      display_name: v.display_name || undefined,
    }).subscribe({
      next: () => this.router.navigate(['/feed']),
      error: (err) => {
        this.error = err.error?.detail ?? 'Registration failed';
        this.loading = false;
      },
    });
  }
}
