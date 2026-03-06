import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, EMPTY } from 'rxjs';
import { AuthStore } from '../store/auth.store';
import { environment } from '../../../environments/environment';

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { username: string; email: string; password: string; display_name?: string; }
export interface TokenResponse { access_token: string; refresh_token: string; token_type: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authStore = inject(AuthStore);

  private readonly TOKEN_KEY = 'sc_access';
  private readonly REFRESH_KEY = 'sc_refresh';
  private readonly base = `${environment.apiUrl}/api/v1/auth`;

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }
  getRefreshToken(): string | null { return localStorage.getItem(this.REFRESH_KEY); }

  register(body: RegisterRequest) {
    return this.http.post<TokenResponse>(`${this.base}/register`, body).pipe(
      tap(tokens => this._storeTokens(tokens))
    );
  }

  login(body: LoginRequest) {
    return this.http.post<TokenResponse>(`${this.base}/login`, body).pipe(
      tap(tokens => this._storeTokens(tokens))
    );
  }

  refreshToken() {
    const refresh_token = this.getRefreshToken();
    if (!refresh_token) return EMPTY;
    return this.http.post<TokenResponse>(`${this.base}/refresh`, { refresh_token }).pipe(
      tap(tokens => this._storeTokens(tokens)),
      catchError(() => { this.logout(); return EMPTY; })
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    this.authStore.clearUser();
    this.router.navigate(['/auth/login']);
  }

  private _storeTokens(tokens: TokenResponse) {
    localStorage.setItem(this.TOKEN_KEY, tokens.access_token);
    localStorage.setItem(this.REFRESH_KEY, tokens.refresh_token);
    this.authStore.loadCurrentUser();
  }
}
