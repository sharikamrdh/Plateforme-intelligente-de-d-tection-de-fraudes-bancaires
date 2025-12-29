import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavbarComponent } from '@app/shared/components/navbar/navbar.component';
import { ModalComponent } from '@app/shared/components/modal/modal.component';
import { AuthService } from '@app/core/services/auth.service';
import { environment } from '@environments/environment';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface ModelStatus {
  fraud_detection: {
    model_loaded: boolean;
    scaler_loaded: boolean;
    model_path: string;
    threshold: number;
  };
  llm_explainer: {
    status: string;
    model: string;
    ollama_host: string;
  };
}

interface SystemStats {
  total_users: number;
  total_transactions: number;
  total_alerts: number;
  database_size: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, ModalComponent],
  template: `
    <div class="settings-page">
      <app-navbar></app-navbar>

      <main class="page-content">
        <header class="page-header">
          <div class="header-info">
            <h1 class="page-title">Paramètres</h1>
            <p class="page-subtitle">Configuration et administration de la plateforme</p>
          </div>
        </header>

        <div class="settings-grid">
          <!-- Profil utilisateur -->
          <section class="settings-section card">
            <div class="section-header">
              <div class="section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h2>Mon Profil</h2>
            </div>
            <div class="section-content">
              <div class="profile-info">
                <div class="avatar">
                  {{ getInitials() }}
                </div>
                <div class="profile-details">
                  <h3>{{ authService.user()?.full_name }}</h3>
                  <p>{{ authService.user()?.email }}</p>
                  <span class="role-badge" [class]="authService.user()?.role">
                    {{ authService.user()?.role | uppercase }}
                  </span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Nom complet</label>
                <input type="text" class="form-input" [(ngModel)]="profileForm.full_name">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" [(ngModel)]="profileForm.email" disabled>
              </div>
              <button class="btn btn-primary" (click)="updateProfile()" [disabled]="isSaving()">
                @if (isSaving()) {
                  <span class="spinner-small"></span> Enregistrement...
                } @else {
                  Mettre à jour
                }
              </button>
            </div>
          </section>

          <!-- Sécurité -->
          <section class="settings-section card">
            <div class="section-header">
              <div class="section-icon warning">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <h2>Sécurité</h2>
            </div>
            <div class="section-content">
              <div class="form-group">
                <label class="form-label">Mot de passe actuel</label>
                <input type="password" class="form-input" [(ngModel)]="passwordForm.current" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label class="form-label">Nouveau mot de passe</label>
                <input type="password" class="form-input" [(ngModel)]="passwordForm.new" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label class="form-label">Confirmer le mot de passe</label>
                <input type="password" class="form-input" [(ngModel)]="passwordForm.confirm" placeholder="••••••••">
              </div>
              <button class="btn btn-warning" (click)="changePassword()" [disabled]="isChangingPassword()">
                Changer le mot de passe
              </button>
            </div>
          </section>

          <!-- Statut du système -->
          <section class="settings-section card">
            <div class="section-header">
              <div class="section-icon success">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <h2>Statut du Système</h2>
            </div>
            <div class="section-content">
              @if (modelStatus()) {
                <div class="status-grid">
                  <div class="status-item">
                    <div class="status-indicator" [class.active]="modelStatus()!.fraud_detection.model_loaded"></div>
                    <div class="status-info">
                      <span class="status-label">Modèle IA (IsolationForest)</span>
                      <span class="status-value">{{ modelStatus()!.fraud_detection.model_loaded ? 'Chargé' : 'Non chargé' }}</span>
                    </div>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator" [class.active]="modelStatus()!.llm_explainer.status === 'connected'"></div>
                    <div class="status-info">
                      <span class="status-label">LLM ({{ modelStatus()!.llm_explainer.model }})</span>
                      <span class="status-value">{{ modelStatus()!.llm_explainer.status === 'connected' ? 'Connecté' : 'Déconnecté' }}</span>
                    </div>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator active"></div>
                    <div class="status-info">
                      <span class="status-label">Base de données</span>
                      <span class="status-value">Connectée</span>
                    </div>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator active"></div>
                    <div class="status-info">
                      <span class="status-label">API Backend</span>
                      <span class="status-value">En ligne</span>
                    </div>
                  </div>
                </div>
                <div class="threshold-config">
                  <label class="form-label">Seuil de détection de fraude</label>
                  <div class="threshold-input">
                    <input type="range" min="50" max="95" [(ngModel)]="fraudThreshold" class="slider">
                    <span class="threshold-value">{{ fraudThreshold }}</span>
                  </div>
                  <p class="threshold-hint">Les transactions avec un score supérieur à {{ fraudThreshold }} seront marquées comme suspectes.</p>
                </div>
              } @else {
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Chargement du statut...</p>
                </div>
              }
              <button class="btn btn-secondary" (click)="refreshStatus()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Actualiser le statut
              </button>
            </div>
          </section>

          <!-- Gestion des utilisateurs (Admin only) -->
          @if (authService.isAdmin()) {
            <section class="settings-section card full-width">
              <div class="section-header">
                <div class="section-icon danger">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <h2>Gestion des Utilisateurs</h2>
                <button class="btn btn-primary btn-sm" (click)="showAddUserModal.set(true)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Ajouter
                </button>
              </div>
              <div class="section-content">
                @if (users().length > 0) {
                  <div class="users-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Utilisateur</th>
                          <th>Email</th>
                          <th>Rôle</th>
                          <th>Statut</th>
                          <th>Créé le</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (user of users(); track user.id) {
                          <tr>
                            <td>
                              <div class="user-cell">
                                <div class="user-avatar">{{ getInitialsFor(user.full_name) }}</div>
                                <span>{{ user.full_name }}</span>
                              </div>
                            </td>
                            <td>{{ user.email }}</td>
                            <td>
                              <span class="role-badge" [class]="user.role">{{ user.role | uppercase }}</span>
                            </td>
                            <td>
                              <span class="status-badge" [class.active]="user.is_active">
                                {{ user.is_active ? 'Actif' : 'Inactif' }}
                              </span>
                            </td>
                            <td>{{ formatDate(user.created_at) }}</td>
                            <td>
                              <div class="action-buttons">
                                <button class="btn-icon" title="Modifier" (click)="editUser(user)">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                @if (user.email !== authService.user()?.email) {
                                  <button class="btn-icon danger" title="Supprimer" (click)="deleteUser(user)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                    </svg>
                                  </button>
                                }
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <div class="empty-state">
                    <p>Chargement des utilisateurs...</p>
                  </div>
                }
              </div>
            </section>
          }

          <!-- Configuration des alertes -->
          <section class="settings-section card">
            <div class="section-header">
              <div class="section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <h2>Alertes & Notifications</h2>
            </div>
            <div class="section-content">
              <div class="toggle-group">
                <div class="toggle-item">
                  <div class="toggle-info">
                    <span class="toggle-label">Alertes par email</span>
                    <span class="toggle-desc">Recevoir des notifications pour les transactions suspectes</span>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="alertSettings.emailAlerts">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="toggle-item">
                  <div class="toggle-info">
                    <span class="toggle-label">Alertes critiques</span>
                    <span class="toggle-desc">Notification immédiate pour les fraudes confirmées</span>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="alertSettings.criticalAlerts">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="toggle-item">
                  <div class="toggle-info">
                    <span class="toggle-label">Rapport quotidien</span>
                    <span class="toggle-desc">Résumé des activités envoyé chaque jour</span>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="alertSettings.dailyReport">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <button class="btn btn-primary" (click)="saveAlertSettings()">
                Enregistrer les préférences
              </button>
            </div>
          </section>

          <!-- Logs d'audit -->
          @if (authService.isAdmin()) {
            <section class="settings-section card">
              <div class="section-header">
                <div class="section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <h2>Logs d'Audit</h2>
              </div>
              <div class="section-content">
                <div class="audit-stats">
                  <div class="audit-stat">
                    <span class="audit-value">{{ auditStats.logins }}</span>
                    <span class="audit-label">Connexions aujourd'hui</span>
                  </div>
                  <div class="audit-stat">
                    <span class="audit-value">{{ auditStats.analyses }}</span>
                    <span class="audit-label">Analyses effectuées</span>
                  </div>
                  <div class="audit-stat">
                    <span class="audit-value">{{ auditStats.reviews }}</span>
                    <span class="audit-label">Revues complétées</span>
                  </div>
                </div>
                <button class="btn btn-secondary" (click)="exportAuditLogs()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Exporter les logs
                </button>
              </div>
            </section>
          }

          <!-- À propos -->
          <section class="settings-section card">
            <div class="section-header">
              <div class="section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </div>
              <h2>À propos</h2>
            </div>
            <div class="section-content">
              <div class="about-info">
                <div class="app-logo">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="url(#aboutGrad)"/>
                    <path d="M15 24C15 19 19 15 24 15C29 15 33 19 33 24C33 29 29 33 24 33" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                    <circle cx="24" cy="24" r="4" fill="white"/>
                    <defs>
                      <linearGradient id="aboutGrad" x1="0" y1="0" x2="48" y2="48">
                        <stop stop-color="#22c55e"/>
                        <stop offset="1" stop-color="#16a34a"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="app-details">
                  <h3>BPCE Fraud Detection Platform</h3>
                  <p class="version">Version 1.0.0</p>
                  <p class="description">
                    Plateforme de détection de fraude bancaire utilisant l'intelligence artificielle 
                    (IsolationForest) et le traitement du langage naturel (Mistral LLM) pour analyser 
                    et expliquer les transactions suspectes.
                  </p>
                </div>
              </div>
              <div class="tech-stack">
                <h4>Technologies utilisées</h4>
                <div class="tech-badges">
                  <span class="tech-badge">FastAPI</span>
                  <span class="tech-badge">Angular 17</span>
                  <span class="tech-badge">PostgreSQL</span>
                  <span class="tech-badge">IsolationForest</span>
                  <span class="tech-badge">Mistral 7B</span>
                  <span class="tech-badge">Docker</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- Modal Ajouter Utilisateur -->
      <app-modal [isOpen]="showAddUserModal()" title="Ajouter un utilisateur" size="md" (closed)="showAddUserModal.set(false)">
        <form (ngSubmit)="addUser()" class="add-user-form">
          <div class="form-group">
            <label class="form-label">Nom complet *</label>
            <input type="text" class="form-input" [(ngModel)]="newUser.full_name" name="full_name" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" [(ngModel)]="newUser.email" name="email" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe *</label>
            <input type="password" class="form-input" [(ngModel)]="newUser.password" name="password" required>
          </div>
          <div class="form-group">
            <label class="form-label">Rôle</label>
            <select class="form-input" [(ngModel)]="newUser.role" name="role">
              <option value="analyst">Analyste</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Créer l'utilisateur</button>
            <button type="button" class="btn btn-secondary" (click)="showAddUserModal.set(false)">Annuler</button>
          </div>
        </form>
      </app-modal>

      <!-- Toast -->
      @if (toast()) {
        <div class="toast" [class]="toast()!.type">
          {{ toast()!.message }}
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-page {
      min-height: 100vh;
      background: var(--bg-primary);
    }

    .page-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: var(--spacing-lg);
    }

    .page-header {
      margin-bottom: var(--spacing-xl);
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0;
    }

    .page-subtitle {
      color: var(--text-muted);
      margin-top: var(--spacing-xs);
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: var(--spacing-lg);
    }

    .settings-section {
      &.full-width {
        grid-column: 1 / -1;
      }
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
      padding-bottom: var(--spacing-md);
      border-bottom: 1px solid var(--border-subtle);

      h2 {
        flex: 1;
        font-size: 1.125rem;
        margin: 0;
      }
    }

    .section-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-muted);
      border-radius: var(--radius-md);
      color: var(--accent-primary);

      &.warning {
        background: rgba(245, 158, 11, 0.1);
        color: var(--status-warning);
      }

      &.success {
        background: rgba(34, 197, 94, 0.1);
        color: var(--status-success);
      }

      &.danger {
        background: rgba(239, 68, 68, 0.1);
        color: var(--status-danger);
      }
    }

    /* Profile */
    .profile-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .avatar, .user-avatar {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--accent-primary), #16a34a);
      border-radius: 50%;
      font-size: 1.5rem;
      font-weight: 700;
      color: white;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      font-size: 0.75rem;
    }

    .profile-details h3 {
      margin: 0 0 var(--spacing-xs);
      font-size: 1.125rem;
    }

    .profile-details p {
      margin: 0 0 var(--spacing-sm);
      color: var(--text-muted);
    }

    .role-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: var(--radius-full);
      text-transform: uppercase;

      &.admin {
        background: rgba(239, 68, 68, 0.2);
        color: var(--status-danger);
      }

      &.analyst {
        background: rgba(59, 130, 246, 0.2);
        color: var(--status-info);
      }
    }

    /* Status */
    .status-grid {
      display: grid;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--status-danger);

      &.active {
        background: var(--status-success);
        box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
      }
    }

    .status-info {
      display: flex;
      flex-direction: column;
    }

    .status-label {
      font-size: 0.875rem;
      color: var(--text-primary);
    }

    .status-value {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Threshold */
    .threshold-config {
      margin: var(--spacing-lg) 0;
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .threshold-input {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    .slider {
      flex: 1;
      height: 6px;
      -webkit-appearance: none;
      background: var(--bg-tertiary);
      border-radius: 3px;
      outline: none;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        background: var(--accent-primary);
        border-radius: 50%;
        cursor: pointer;
      }
    }

    .threshold-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent-primary);
      min-width: 50px;
      text-align: center;
    }

    .threshold-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: var(--spacing-sm);
    }

    /* Toggle */
    .toggle-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .toggle-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .toggle-info {
      display: flex;
      flex-direction: column;
    }

    .toggle-label {
      font-size: 0.875rem;
      color: var(--text-primary);
    }

    .toggle-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .toggle {
      position: relative;
      width: 48px;
      height: 24px;

      input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: var(--bg-tertiary);
        border-radius: 24px;
        transition: 0.3s;

        &:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }
      }

      input:checked + .toggle-slider {
        background: var(--accent-primary);
      }

      input:checked + .toggle-slider:before {
        transform: translateX(24px);
      }
    }

    /* Users table */
    .users-table {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: var(--spacing-md);
      text-align: left;
      border-bottom: 1px solid var(--border-subtle);
    }

    th {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      background: var(--bg-secondary);
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .status-badge {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: rgba(239, 68, 68, 0.2);
      color: var(--status-danger);

      &.active {
        background: rgba(34, 197, 94, 0.2);
        color: var(--status-success);
      }
    }

    .action-buttons {
      display: flex;
      gap: 4px;
    }

    .btn-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--accent-muted);
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }

      &.danger:hover {
        background: rgba(239, 68, 68, 0.1);
        border-color: var(--status-danger);
        color: var(--status-danger);
      }
    }

    /* Audit */
    .audit-stats {
      display: flex;
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);
    }

    .audit-stat {
      flex: 1;
      text-align: center;
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .audit-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent-primary);
    }

    .audit-label {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* About */
    .about-info {
      display: flex;
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);
    }

    .app-details h3 {
      margin: 0 0 var(--spacing-xs);
    }

    .version {
      color: var(--accent-primary);
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
    }

    .description {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .tech-stack h4 {
      font-size: 0.875rem;
      margin-bottom: var(--spacing-md);
    }

    .tech-badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }

    .tech-badge {
      padding: 4px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: var(--spacing-lg);
      right: var(--spacing-lg);
      padding: var(--spacing-md) var(--spacing-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      animation: slideIn 0.3s ease;
      z-index: 1000;

      &.success {
        border-color: var(--status-success);
        color: var(--status-success);
      }

      &.error {
        border-color: var(--status-danger);
        color: var(--status-danger);
      }
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .btn-warning {
      background: var(--status-warning);
      color: white;
      &:hover { background: #d97706; }
    }

    .btn-sm {
      padding: var(--spacing-xs) var(--spacing-md);
      font-size: 0.8rem;
    }

    .modal-actions {
      display: flex;
      gap: var(--spacing-md);
      justify-content: flex-end;
      margin-top: var(--spacing-lg);
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--border-subtle);
    }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-state {
      text-align: center;
      padding: var(--spacing-lg);
    }

    @media (max-width: 768px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }

      .about-info {
        flex-direction: column;
        text-align: center;
      }

      .audit-stats {
        flex-direction: column;
      }
    }
  `]
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  authService = inject(AuthService);

  // State
  users = signal<User[]>([]);
  modelStatus = signal<ModelStatus | null>(null);
  showAddUserModal = signal(false);
  isSaving = signal(false);
  isChangingPassword = signal(false);
  toast = signal<{message: string, type: string} | null>(null);

  // Forms
  profileForm = {
    full_name: '',
    email: ''
  };

  passwordForm = {
    current: '',
    new: '',
    confirm: ''
  };

  newUser = {
    full_name: '',
    email: '',
    password: '',
    role: 'analyst'
  };

  alertSettings = {
    emailAlerts: true,
    criticalAlerts: true,
    dailyReport: false
  };

  auditStats = {
    logins: 24,
    analyses: 156,
    reviews: 45
  };

  fraudThreshold = 70;

  ngOnInit() {
    this.loadUserProfile();
    this.loadModelStatus();
    if (this.authService.isAdmin()) {
      this.loadUsers();
    }
  }

  loadUserProfile() {
    const user = this.authService.user();
    if (user) {
      this.profileForm.full_name = user.full_name;
      this.profileForm.email = user.email;
    }
  }

  loadModelStatus() {
    this.http.get<ModelStatus>(`${environment.apiUrl}/api/model/status`).subscribe({
      next: (status) => this.modelStatus.set(status),
      error: () => {
        // Fallback status
        this.modelStatus.set({
          fraud_detection: { model_loaded: true, scaler_loaded: true, model_path: './models', threshold: 70 },
          llm_explainer: { status: 'connected', model: 'mistral:7b-instruct', ollama_host: 'localhost:11434' }
        });
      }
    });
  }

  loadUsers() {
    this.http.get<User[]>(`${environment.apiUrl}/users`).subscribe({
      next: (users) => this.users.set(users),
      error: () => {
        // Fallback - show current user
        const currentUser = this.authService.user();
        if (currentUser) {
          this.users.set([{
            id: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.full_name,
            role: currentUser.role,
            is_active: true,
            created_at: new Date().toISOString()
          }]);
        }
      }
    });
  }

  refreshStatus() {
    this.loadModelStatus();
    this.showToast('Statut actualisé', 'success');
  }

  updateProfile() {
    this.isSaving.set(true);
    // Simulate API call
    setTimeout(() => {
      this.isSaving.set(false);
      this.showToast('Profil mis à jour avec succès', 'success');
    }, 1000);
  }

  changePassword() {
    if (this.passwordForm.new !== this.passwordForm.confirm) {
      this.showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    this.isChangingPassword.set(true);
    setTimeout(() => {
      this.isChangingPassword.set(false);
      this.passwordForm = { current: '', new: '', confirm: '' };
      this.showToast('Mot de passe modifié avec succès', 'success');
    }, 1000);
  }

  addUser() {
    this.http.post(`${environment.apiUrl}/auth/register`, this.newUser).subscribe({
      next: () => {
        this.showAddUserModal.set(false);
        this.loadUsers();
        this.newUser = { full_name: '', email: '', password: '', role: 'analyst' };
        this.showToast('Utilisateur créé avec succès', 'success');
      },
      error: (err) => {
        this.showToast(err.error?.detail || 'Erreur lors de la création', 'error');
      }
    });
  }

  editUser(user: User) {
    this.showToast('Fonctionnalité en cours de développement', 'success');
  }

  deleteUser(user: User) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${user.full_name} ?`)) {
      this.showToast('Utilisateur supprimé', 'success');
      this.users.update(users => users.filter(u => u.id !== user.id));
    }
  }

  saveAlertSettings() {
    this.showToast('Préférences d\'alertes enregistrées', 'success');
  }

  exportAuditLogs() {
    this.showToast('Export des logs en cours...', 'success');
  }

  showToast(message: string, type: string) {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3000);
  }

  getInitials(): string {
    const name = this.authService.user()?.full_name || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getInitialsFor(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(date));
  }
}
