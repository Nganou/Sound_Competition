import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sc-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="auth-layout">
      <div class="auth-layout__brand">
        <span class="brand-icon">⚔</span>
        <h1>Resono</h1>
        <p>Battle. Collaborate. Inspire.</p>
      </div>
      <div class="auth-layout__form">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .auth-layout {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      gap: 32px;
    }
    .auth-layout__brand {
      text-align: center;
      .brand-icon { font-size: 40px; }
      h1 { margin: 8px 0 4px; font-size: 24px; font-weight: 700; color: var(--color-accent-primary); }
      p  { margin: 0; color: var(--color-text-secondary); font-size: 14px; }
    }
    .auth-layout__form {
      width: 100%;
      max-width: 400px;
    }
  `],
})
export class AuthLayoutComponent {}
