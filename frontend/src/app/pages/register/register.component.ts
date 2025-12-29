import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="register-page">
      <div class="decor decor-1"></div>
      <div class="decor decor-2"></div>
      
      <div class="register-container animate-slideUp">
        <div class="register-card">
          <div class="register-header">
            <div class="logo">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="url(#regGradient)" />
                <path d="M15 24C15 19.0294 19.0294 15 24 15C28.9706 15 33 19.0294 33 24C33 28.9706 28.9706 33 24 33" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="24" cy="24" r="4" fill="white"/>
                <defs>
                  <linearGradient id="regGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#22c55e"/>
                    <stop offset="1" stop-color="#16a34a"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 class="register-title">Créer un compte</h1>
            <p class="register-subtitle">Rejoignez la plateforme de détection de fraude</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="register-form">
            @if (error()) {
              <div class="error-message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {{ error() }}
              </div>
            }

            @if (success()) {
              <div class="success-message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ success() }}
              </div>
            }

            <div class="form-group">
              <label for="fullName" class="form-label">Nom complet</label>
              <input
                type="text"
                id="fullName"
                class="form-input"
                [(ngModel)]="fullName"
                name="fullName"
                placeholder="Jean Dupont"
                required
              />
            </div>

            <div class="form-group">
              <label for="email" class="form-label">Email</label>
              <input
                type="email"
                id="email"
                class="form-input"
                [(ngModel)]="email"
                name="email"
                placeholder="votre.email@bpce.fr"
                required
              />
            </div>

            <div class="form-group">
              <label for="password" class="form-label">Mot de passe</label>
              <input
                type="password"
                id="password"
                class="form-input"
                [(ngModel)]="password"
                name="password"
                placeholder="••••••••"
                required
              />
            </div>

            <div class="form-group">
              <label for="role" class="form-label">Rôle</label>
              <select id="role" class="form-input" [(ngModel)]="role" name="role">
                <option value="analyst">Analyste</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary btn-register" [disabled]="isLoading()">
              @if (isLoading()) {
                <span class="spinner-small"></span>
                Création...
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                Créer mon compte
              }
            </button>
          </form>

          <div class="register-footer">
            <p>Déjà un compte ? <a routerLink="/login">Se connecter</a></p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-lg);
      position: relative;
      overflow: hidden;
    }

    .decor {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }

    .decor-1 {
      width: 600px;
      height: 600px;
      top: -200px;
      right: -200px;
      background: radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%);
    }

    .decor-2 {
      width: 400px;
      height: 400px;
      bottom: -100px;
      left: -100px;
      background: radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%);
    }

    .register-container {
      width: 100%;
      max-width: 420px;
      z-index: 1;
    }

    .register-card {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      padding: var(--spacing-2xl);
      box-shadow: var(--shadow-lg), var(--shadow-glow);
    }

    .register-header {
      text-align: center;
      margin-bottom: var(--spacing-xl);
    }

    .logo {
      display: inline-flex;
      margin-bottom: var(--spacing-md);
    }

    .register-title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .register-subtitle {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: var(--spacing-sm);
    }

    .register-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .form-group {
      margin-bottom: 0;
    }

    .btn-register {
      width: 100%;
      padding: var(--spacing-md) var(--spacing-lg);
      font-size: 1rem;
      margin-top: var(--spacing-md);
    }

    .spinner-small {
      width: 18px;
      height: 18px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      color: var(--status-danger);
      font-size: 0.875rem;
    }

    .success-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: var(--radius-md);
      color: var(--status-success);
      font-size: 0.875rem;
    }

    .register-footer {
      margin-top: var(--spacing-xl);
      text-align: center;
      font-size: 0.875rem;
      color: var(--text-muted);

      a {
        color: var(--accent-primary);
        text-decoration: none;
        font-weight: 500;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  `]
})
export class RegisterComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  fullName = '';
  email = '';
  password = '';
  role = 'analyst';
  
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  isLoading = signal(false);

  onSubmit(): void {
    this.error.set(null);
    this.success.set(null);

    if (!this.fullName || !this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs');
      return;
    }

    if (this.password.length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    this.isLoading.set(true);

    this.http.post(`${environment.apiUrl}/auth/register`, {
      email: this.email,
      password: this.password,
      full_name: this.fullName,
      role: this.role
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.success.set('Compte créé avec succès ! Redirection...');
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 400) {
          this.error.set(err.error?.detail || 'Un compte avec cet email existe déjà');
        } else {
          this.error.set('Une erreur est survenue. Veuillez réessayer.');
        }
      }
    });
  }
}
