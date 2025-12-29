import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@environments/environment';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  
  private _user = signal<User | null>(null);
  private _token = signal<string | null>(null);
  private _isLoading = signal(false);

  user = computed(() => this._user());
  token = computed(() => this._token());
  isLoading = computed(() => this._isLoading());
  isAuthenticated = computed(() => !!this._token());
  isAdmin = computed(() => this._user()?.role === 'admin');

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        this._token.set(token);
        this._user.set(JSON.parse(userStr));
      } catch {
        this.clearAuth();
      }
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    this._isLoading.set(true);
    
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        console.log('Login response:', response);
        
        const user: User = {
          id: response.user_id,
          email: response.email,
          full_name: response.full_name,
          role: response.role
        };
        
        this._token.set(response.access_token);
        this._user.set(user);
        
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify(user));
        
        this._isLoading.set(false);
        
        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
      }),
      catchError(error => {
        console.error('Login error:', error);
        this._isLoading.set(false);
        return throwError(() => error);
      })
    );
  }

  register(data: { email: string; password: string; full_name: string; role?: string }): Observable<any> {
    this._isLoading.set(true);
    
    return this.http.post(`${this.apiUrl}/auth/register`, {
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      role: data.role || 'analyst'
    }).pipe(
      tap(() => this._isLoading.set(false)),
      catchError(error => {
        this._isLoading.set(false);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  private clearAuth(): void {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return this._token();
  }
}
