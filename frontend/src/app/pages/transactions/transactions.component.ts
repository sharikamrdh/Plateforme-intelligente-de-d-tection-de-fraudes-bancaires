import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '@app/shared/components/navbar/navbar.component';
import { ModalComponent } from '@app/shared/components/modal/modal.component';
import { TransactionService, Transaction, AnalysisResponse } from '@app/core/services/transaction.service';
import { AuthService } from '@app/core/services/auth.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, ModalComponent],
  template: `
    <div class="transactions-page">
      <app-navbar></app-navbar>

      <main class="page-content">
        <!-- Header -->
        <header class="page-header">
          <div class="header-info">
            <h1 class="page-title">Transactions</h1>
            <p class="page-subtitle">Gérez et analysez toutes les transactions bancaires</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" (click)="loadTransactions()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Actualiser
            </button>
            <button class="btn btn-primary" (click)="showCreateModal.set(true)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nouvelle transaction
            </button>
          </div>
        </header>

        <!-- Stats rapides -->
        <div class="quick-stats">
          @if (transactionService.stats(); as stats) {
            <div class="stat-item">
              <span class="stat-number">{{ stats.total_transactions }}</span>
              <span class="stat-label">Total</span>
            </div>
            <div class="stat-item warning">
              <span class="stat-number">{{ stats.suspicious_count }}</span>
              <span class="stat-label">Suspectes</span>
            </div>
            <div class="stat-item danger">
              <span class="stat-number">{{ stats.confirmed_fraud_count }}</span>
              <span class="stat-label">Fraudes</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ stats.pending_review }}</span>
              <span class="stat-label">En attente</span>
            </div>
          }
        </div>

        <!-- Filtres -->
        <div class="filters-bar card">
          <div class="filter-group">
            <label>Recherche</label>
            <input 
              type="text" 
              class="form-input" 
              placeholder="Référence, nom..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="onFilterChange()"
            />
          </div>
          <div class="filter-group">
            <label>Statut</label>
            <select class="form-input" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
              <option value="">Tous</option>
              <option value="pending">En attente</option>
              <option value="analyzed">Analysé</option>
              <option value="confirmed_fraud">Fraude confirmée</option>
              <option value="cleared">Validé</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Risque</label>
            <select class="form-input" [(ngModel)]="suspiciousFilter" (ngModelChange)="onFilterChange()">
              <option value="">Tous</option>
              <option value="true">Suspects uniquement</option>
              <option value="false">Non suspects</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Montant min</label>
            <input 
              type="number" 
              class="form-input" 
              placeholder="0"
              [(ngModel)]="minAmount"
              (ngModelChange)="onFilterChange()"
            />
          </div>
          <div class="filter-group">
            <label>Montant max</label>
            <input 
              type="number" 
              class="form-input" 
              placeholder="999999"
              [(ngModel)]="maxAmount"
              (ngModelChange)="onFilterChange()"
            />
          </div>
        </div>

        <!-- Tableau des transactions -->
        <div class="transactions-table card">
          @if (transactionService.isLoading()) {
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Chargement des transactions...</p>
            </div>
          } @else if (transactionService.transactions().length === 0) {
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <h3>Aucune transaction</h3>
              <p>Aucune transaction ne correspond à vos critères</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th (click)="sortBy('transaction_ref')" class="sortable">
                      Référence
                      @if (currentSort === 'transaction_ref') {
                        <span>{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                      }
                    </th>
                    <th (click)="sortBy('amount')" class="sortable">
                      Montant
                      @if (currentSort === 'amount') {
                        <span>{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                      }
                    </th>
                    <th>Type</th>
                    <th>Expéditeur</th>
                    <th>Bénéficiaire</th>
                    <th (click)="sortBy('transaction_date')" class="sortable">
                      Date
                      @if (currentSort === 'transaction_date') {
                        <span>{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                      }
                    </th>
                    <th (click)="sortBy('fraud_score')" class="sortable">
                      Score
                      @if (currentSort === 'fraud_score') {
                        <span>{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                      }
                    </th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (tx of transactionService.transactions(); track tx.id) {
                    <tr [class.suspicious]="tx.is_suspicious" [class.fraud]="tx.is_confirmed_fraud">
                      <td>
                        <code class="ref">{{ tx.transaction_ref }}</code>
                      </td>
                      <td>
                        <span class="amount" [class.high]="tx.amount > 5000">
                          {{ formatCurrency(tx.amount) }}
                        </span>
                      </td>
                      <td>
                        <span class="type-badge">{{ getTypeIcon(tx.transaction_type) }} {{ tx.transaction_type }}</span>
                      </td>
                      <td>
                        <div class="person-info">
                          <span class="name">{{ tx.sender_name || 'N/A' }}</span>
                          <span class="account">{{ tx.sender_account | slice:0:10 }}...</span>
                        </div>
                      </td>
                      <td>
                        <div class="person-info">
                          <span class="name">{{ tx.receiver_name || 'N/A' }}</span>
                          <span class="country">{{ tx.country_destination || 'FR' }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="date">{{ formatDate(tx.transaction_date) }}</span>
                      </td>
                      <td>
                        @if (tx.fraud_score !== null) {
                          <div class="score-cell">
                            <div class="score-badge" [class]="getScoreClass(tx.fraud_score)">
                              {{ tx.fraud_score }}
                            </div>
                            <div class="score-bar-mini">
                              <div class="fill" [style.width.%]="tx.fraud_score" [class]="getScoreClass(tx.fraud_score)"></div>
                            </div>
                          </div>
                        } @else {
                          <span class="no-score">—</span>
                        }
                      </td>
                      <td>
                        <span class="status-badge" [class]="getStatusClass(tx.status)">
                          {{ getStatusLabel(tx.status) }}
                        </span>
                      </td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn-icon" title="Voir détails" (click)="viewDetails(tx)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          <button 
                            class="btn-icon primary" 
                            title="Analyser" 
                            (click)="analyzeTransaction(tx)"
                            [disabled]="tx.status === 'confirmed_fraud' || tx.status === 'cleared'"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          </button>
                          @if (tx.is_suspicious && tx.status !== 'confirmed_fraud' && tx.status !== 'cleared') {
                            <button class="btn-icon danger" title="Bloquer" (click)="blockTransaction(tx)">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                              </svg>
                            </button>
                            <button class="btn-icon warning" title="Ouvrir ticket" (click)="createTicket(tx)">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="12" y1="18" x2="12" y2="12"/>
                                <line x1="9" y1="15" x2="15" y2="15"/>
                              </svg>
                            </button>
                            <button class="btn-icon info" title="Appeler client" (click)="callClient(tx)">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                              </svg>
                            </button>
                            <button class="btn-icon success" title="Approuver (fausse alerte)" (click)="approveTransaction(tx)">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"/>
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

            <!-- Pagination -->
            <div class="pagination">
              <button 
                class="btn btn-secondary btn-sm" 
                [disabled]="currentPage === 1"
                (click)="goToPage(currentPage - 1)"
              >
                ← Précédent
              </button>
              <div class="page-numbers">
                @for (page of getPageNumbers(); track page) {
                  <button 
                    class="page-btn" 
                    [class.active]="page === currentPage"
                    (click)="goToPage(page)"
                  >
                    {{ page }}
                  </button>
                }
              </div>
              <button 
                class="btn btn-secondary btn-sm"
                [disabled]="currentPage === transactionService.totalPages()"
                (click)="goToPage(currentPage + 1)"
              >
                Suivant →
              </button>
              <span class="page-info">
                {{ transactionService.totalCount() }} transactions
              </span>
            </div>
          }
        </div>
      </main>

      <!-- Modal Détails -->
      <app-modal [isOpen]="showDetailsModal()" title="Détails de la transaction" size="lg" (closed)="closeModals()">
        @if (selectedTransaction(); as tx) {
          <div class="details-content">
            <div class="details-grid">
              <div class="detail-section">
                <h4>Informations générales</h4>
                <div class="detail-row">
                  <span class="label">Référence</span>
                  <span class="value"><code>{{ tx.transaction_ref }}</code></span>
                </div>
                <div class="detail-row">
                  <span class="label">Montant</span>
                  <span class="value amount">{{ formatCurrency(tx.amount) }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Type</span>
                  <span class="value">{{ tx.transaction_type }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Canal</span>
                  <span class="value">{{ tx.channel }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date</span>
                  <span class="value">{{ formatDate(tx.transaction_date) }}</span>
                </div>
              </div>

              <div class="detail-section">
                <h4>Expéditeur</h4>
                <div class="detail-row">
                  <span class="label">Nom</span>
                  <span class="value">{{ tx.sender_name || 'N/A' }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Compte</span>
                  <span class="value"><code>{{ tx.sender_account }}</code></span>
                </div>
                <div class="detail-row">
                  <span class="label">Pays</span>
                  <span class="value">{{ tx.country_origin || 'FR' }}</span>
                </div>
              </div>

              <div class="detail-section">
                <h4>Bénéficiaire</h4>
                <div class="detail-row">
                  <span class="label">Nom</span>
                  <span class="value">{{ tx.receiver_name || 'N/A' }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Compte</span>
                  <span class="value"><code>{{ tx.receiver_account }}</code></span>
                </div>
                <div class="detail-row">
                  <span class="label">Pays</span>
                  <span class="value">{{ tx.country_destination || 'FR' }}</span>
                </div>
              </div>

              <div class="detail-section">
                <h4>Analyse de fraude</h4>
                <div class="detail-row">
                  <span class="label">Score</span>
                  <span class="value">
                    @if (tx.fraud_score !== null) {
                      <span class="score-badge" [class]="getScoreClass(tx.fraud_score)">{{ tx.fraud_score }}/100</span>
                    } @else {
                      Non analysé
                    }
                  </span>
                </div>
                <div class="detail-row">
                  <span class="label">Statut</span>
                  <span class="value">
                    <span class="status-badge" [class]="getStatusClass(tx.status)">{{ getStatusLabel(tx.status) }}</span>
                  </span>
                </div>
                @if (tx.ai_explanation) {
                  <div class="detail-row full">
                    <span class="label">Explication IA</span>
                    <p class="explanation">{{ tx.ai_explanation }}</p>
                  </div>
                }
              </div>
            </div>

            <div class="modal-actions">
              @if (tx.status !== 'confirmed_fraud' && tx.status !== 'cleared') {
                <button class="btn btn-primary" (click)="analyzeTransaction(tx); closeModals()">
                  Analyser
                </button>
              }
              <button class="btn btn-secondary" (click)="closeModals()">Fermer</button>
            </div>
          </div>
        }
      </app-modal>

      <!-- Modal Analyse -->
      <app-modal [isOpen]="showAnalysisModal()" title="Résultat de l'analyse" size="lg" (closed)="closeModals()">
        @if (isAnalyzing()) {
          <div class="analysis-loading">
            <div class="spinner"></div>
            <p>Analyse en cours...</p>
            <p class="sub">L'IA analyse la transaction</p>
          </div>
        } @else if (analysisResult()) {
          <div class="analysis-result">
            <div class="score-display" [class.high-risk]="analysisResult()!.fraud_score >= 70">
              <div class="big-score" [class]="getScoreClass(analysisResult()!.fraud_score)">
                {{ analysisResult()!.fraud_score }}
              </div>
              <div class="score-label">Score de fraude</div>
              <div class="risk-badge" [class]="getScoreClass(analysisResult()!.fraud_score)">
                {{ analysisResult()!.risk_level | uppercase }}
              </div>
            </div>

            @if (analysisResult()!.factors && analysisResult()!.factors.length > 0) {
              <div class="factors-section">
                <h4>Facteurs de risque</h4>
                <ul class="factors-list">
                  @for (factor of analysisResult()!.factors; track factor) {
                    <li>⚠️ {{ factor }}</li>
                  }
                </ul>
              </div>
            }

            <div class="explanation-section">
              <h4>Explication de l'IA</h4>
              <p class="explanation-text">{{ analysisResult()!.ai_explanation }}</p>
            </div>

            <div class="modal-actions">
              @if (analysisResult()!.is_suspicious) {
                <button class="btn btn-danger" (click)="confirmReview(true)">
                  Confirmer fraude
                </button>
                <button class="btn btn-success" (click)="confirmReview(false)">
                  Valider (pas de fraude)
                </button>
              }
              <button class="btn btn-secondary" (click)="closeModals()">Fermer</button>
            </div>
          </div>
        }
      </app-modal>

      <!-- Modal Création -->
      <app-modal [isOpen]="showCreateModal()" title="Nouvelle transaction" size="lg" (closed)="closeModals()">
        <form (ngSubmit)="createTransaction()" class="create-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Montant *</label>
              <input type="number" class="form-input" [(ngModel)]="newTransaction.amount" name="amount" required min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">Devise</label>
              <select class="form-input" [(ngModel)]="newTransaction.currency" name="currency">
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type *</label>
              <select class="form-input" [(ngModel)]="newTransaction.transaction_type" name="type" required>
                <option value="virement">Virement</option>
                <option value="carte">Carte</option>
                <option value="prelevement">Prélèvement</option>
                <option value="retrait">Retrait</option>
                <option value="depot">Dépôt</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Canal</label>
              <select class="form-input" [(ngModel)]="newTransaction.channel" name="channel">
                <option value="web">Web</option>
                <option value="mobile">Mobile</option>
                <option value="agence">Agence</option>
                <option value="atm">ATM</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nom expéditeur</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.sender_name" name="sender_name">
            </div>
            <div class="form-group">
              <label class="form-label">Compte expéditeur *</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.sender_account" name="sender_account" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nom bénéficiaire</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.receiver_name" name="receiver_name">
            </div>
            <div class="form-group">
              <label class="form-label">Compte bénéficiaire *</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.receiver_account" name="receiver_account" required>
            </div>
            <div class="form-group">
              <label class="form-label">Pays origine</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.country_origin" name="country_origin" maxlength="3" placeholder="FRA">
            </div>
            <div class="form-group">
              <label class="form-label">Pays destination</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.country_destination" name="country_destination" maxlength="3" placeholder="FRA">
            </div>
            <div class="form-group full-width">
              <label class="form-label">Description</label>
              <input type="text" class="form-input" [(ngModel)]="newTransaction.description" name="description">
            </div>
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary" [disabled]="isCreating()">
              @if (isCreating()) {
                <span class="spinner-small"></span> Création...
              } @else {
                Créer la transaction
              }
            </button>
            <button type="button" class="btn btn-secondary" (click)="closeModals()">Annuler</button>
          </div>
        </form>
      </app-modal>

      <!-- Modal Résultat Action -->
      <app-modal [isOpen]="showActionModal()" [title]="getActionTitle()" size="md" (closed)="closeModals()">
        @if (actionResult()) {
          <div class="action-result">
            <div class="action-icon" [class]="actionType()">
              @if (actionType() === 'block') {
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              }
              @if (actionType() === 'ticket') {
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              }
              @if (actionType() === 'call') {
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
              }
              @if (actionType() === 'approve') {
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            </div>
            
            <h3 class="action-message">{{ actionResult().message }}</h3>
            
            <div class="action-details">
              @if (actionType() === 'ticket' && actionResult().ticket_number) {
                <div class="detail-item highlight">
                  <span class="label">Numéro de ticket</span>
                  <span class="value ticket-number">{{ actionResult().ticket_number }}</span>
                </div>
              }
              @if (actionType() === 'call' && actionResult().call_id) {
                <div class="detail-item highlight">
                  <span class="label">ID Appel</span>
                  <span class="value">{{ actionResult().call_id }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Client</span>
                  <span class="value">{{ actionResult().client_name }}</span>
                </div>
                <div class="detail-item instructions">
                  <span class="label">Instructions</span>
                  <span class="value">{{ actionResult().instructions }}</span>
                </div>
              }
              @if (actionResult().transaction_ref) {
                <div class="detail-item">
                  <span class="label">Transaction</span>
                  <span class="value">{{ actionResult().transaction_ref }}</span>
                </div>
              }
              @if (actionResult().amount) {
                <div class="detail-item">
                  <span class="label">Montant</span>
                  <span class="value">{{ formatCurrency(actionResult().amount) }}</span>
                </div>
              }
              @if (actionResult().status) {
                <div class="detail-item">
                  <span class="label">Nouveau statut</span>
                  <span class="value status-badge" [class]="actionResult().status">{{ getStatusLabel(actionResult().status) }}</span>
                </div>
              }
            </div>
            
            <div class="modal-actions">
              <button class="btn btn-primary" (click)="closeModals()">Fermer</button>
            </div>
          </div>
        }
      </app-modal>
    </div>
  `,
  styles: [`
    .transactions-page {
      min-height: 100vh;
      background: var(--bg-primary);
    }

    .page-content {
      max-width: 1600px;
      margin: 0 auto;
      padding: var(--spacing-lg);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-lg);
      flex-wrap: wrap;
      gap: var(--spacing-md);
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

    .header-actions {
      display: flex;
      gap: var(--spacing-sm);
    }

    /* Quick Stats */
    .quick-stats {
      display: flex;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
      flex-wrap: wrap;
    }

    .stat-item {
      background: var(--glass-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--spacing-md) var(--spacing-lg);
      display: flex;
      flex-direction: column;
      min-width: 120px;
    }

    .stat-number {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .stat-item.warning .stat-number { color: var(--status-warning); }
    .stat-item.danger .stat-number { color: var(--status-danger); }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    /* Filters */
    .filters-bar {
      display: flex;
      gap: var(--spacing-md);
      flex-wrap: wrap;
      margin-bottom: var(--spacing-lg);
      padding: var(--spacing-md);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      min-width: 150px;
    }

    .filter-group label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .filter-group .form-input {
      padding: var(--spacing-sm);
      font-size: 0.875rem;
    }

    /* Table */
    .transactions-table {
      overflow: hidden;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: var(--bg-tertiary);
      padding: var(--spacing-md);
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      white-space: nowrap;
    }

    th.sortable {
      cursor: pointer;
      &:hover { color: var(--accent-primary); }
    }

    td {
      padding: var(--spacing-md);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.875rem;
    }

    tr:hover td {
      background: var(--bg-card-hover);
    }

    tr.suspicious {
      background: rgba(245, 158, 11, 0.05);
    }

    tr.fraud {
      background: rgba(239, 68, 68, 0.05);
    }

    .ref {
      font-size: 0.75rem;
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .amount {
      font-weight: 600;
      &.high { color: var(--status-warning); }
    }

    .type-badge {
      font-size: 0.8rem;
      text-transform: capitalize;
    }

    .person-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      .name { color: var(--text-primary); font-size: 0.875rem; }
      .account, .country { color: var(--text-muted); font-size: 0.75rem; }
    }

    .date {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    .score-cell {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .score-badge {
      font-weight: 700;
      font-size: 0.875rem;
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      &.low { background: rgba(34, 197, 94, 0.2); color: var(--status-success); }
      &.medium { background: rgba(245, 158, 11, 0.2); color: var(--status-warning); }
      &.high { background: rgba(239, 68, 68, 0.2); color: var(--status-danger); }
      &.critical { background: rgba(220, 38, 38, 0.3); color: #ff4444; }
    }

    .score-bar-mini {
      width: 40px;
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      overflow: hidden;
      .fill {
        height: 100%;
        &.low { background: var(--status-success); }
        &.medium { background: var(--status-warning); }
        &.high { background: var(--status-danger); }
        &.critical { background: #ff4444; }
      }
    }

    .no-score {
      color: var(--text-muted);
    }

    .status-badge {
      font-size: 0.7rem;
      padding: 4px 8px;
      border-radius: var(--radius-full);
      font-weight: 600;
      text-transform: uppercase;
      &.pending { background: rgba(59, 130, 246, 0.2); color: var(--status-info); }
      &.analyzed { background: rgba(245, 158, 11, 0.2); color: var(--status-warning); }
      &.confirmed_fraud { background: rgba(239, 68, 68, 0.2); color: var(--status-danger); }
      &.cleared { background: rgba(34, 197, 94, 0.2); color: var(--status-success); }
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
      border: 1px solid var(--border-color);
      background: transparent;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover:not(:disabled) {
        background: var(--accent-muted);
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      &.primary:hover:not(:disabled) {
        background: rgba(59, 130, 246, 0.2);
        border-color: var(--status-info);
        color: var(--status-info);
      }

      &.success:hover:not(:disabled) {
        background: rgba(34, 197, 94, 0.2);
        border-color: var(--status-success);
        color: var(--status-success);
      }

      &.danger:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.2);
        border-color: var(--status-danger);
        color: var(--status-danger);
      }

      &.warning:hover:not(:disabled) {
        background: rgba(245, 158, 11, 0.2);
        border-color: var(--status-warning);
        color: var(--status-warning);
      }

      &.info:hover:not(:disabled) {
        background: rgba(59, 130, 246, 0.2);
        border-color: var(--status-info);
        color: var(--status-info);
      }
    }

    /* Action Result Modal */
    .action-result {
      text-align: center;
      padding: var(--spacing-lg);
    }

    .action-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto var(--spacing-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      
      &.block {
        background: rgba(239, 68, 68, 0.2);
        color: var(--status-danger);
      }
      
      &.ticket {
        background: rgba(245, 158, 11, 0.2);
        color: var(--status-warning);
      }
      
      &.call {
        background: rgba(59, 130, 246, 0.2);
        color: var(--status-info);
      }
      
      &.approve {
        background: rgba(34, 197, 94, 0.2);
        color: var(--status-success);
      }
    }

    .action-message {
      font-size: 1.25rem;
      margin-bottom: var(--spacing-lg);
    }

    .action-details {
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
      text-align: left;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      padding: var(--spacing-sm) 0;
      border-bottom: 1px solid var(--border-subtle);
      
      &:last-child {
        border-bottom: none;
      }
      
      &.highlight {
        background: var(--accent-muted);
        margin: calc(var(--spacing-sm) * -1);
        padding: var(--spacing-md);
        border-radius: var(--radius-sm);
        margin-bottom: var(--spacing-sm);
      }
      
      &.instructions {
        flex-direction: column;
        gap: var(--spacing-xs);
      }
      
      .label {
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      
      .value {
        font-weight: 500;
        color: var(--text-primary);
        
        &.ticket-number {
          font-family: monospace;
          font-size: 1.1rem;
          color: var(--accent-primary);
        }
      }
    }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      border-top: 1px solid var(--border-subtle);
      flex-wrap: wrap;
    }

    .page-numbers {
      display: flex;
      gap: 4px;
    }

    .page-btn {
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-color);
      background: transparent;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      &:hover { background: var(--accent-muted); }
      &.active {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: var(--bg-primary);
      }
    }

    .page-info {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* Loading & Empty states */
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-2xl);
      color: var(--text-muted);
      text-align: center;
    }

    .empty-state svg {
      opacity: 0.3;
      margin-bottom: var(--spacing-md);
    }

    .empty-state h3 {
      margin-bottom: var(--spacing-sm);
    }

    /* Modal content */
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--spacing-lg);
    }

    .detail-section {
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
    }

    .detail-section h4 {
      font-size: 0.875rem;
      color: var(--accent-primary);
      margin-bottom: var(--spacing-md);
      padding-bottom: var(--spacing-sm);
      border-bottom: 1px solid var(--border-subtle);
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: var(--spacing-xs) 0;
      font-size: 0.875rem;
      &.full { flex-direction: column; gap: var(--spacing-sm); }
    }

    .detail-row .label {
      color: var(--text-muted);
    }

    .detail-row .value {
      color: var(--text-primary);
      font-weight: 500;
    }

    .explanation {
      background: var(--bg-tertiary);
      padding: var(--spacing-md);
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      line-height: 1.6;
    }

    /* Analysis Modal */
    .analysis-loading {
      text-align: center;
      padding: var(--spacing-2xl);
      .sub { color: var(--text-muted); font-size: 0.875rem; }
    }

    .analysis-result {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }

    .score-display {
      text-align: center;
      padding: var(--spacing-xl);
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      &.high-risk {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
    }

    .big-score {
      font-size: 4rem;
      font-weight: 700;
      line-height: 1;
      &.low { color: var(--status-success); }
      &.medium { color: var(--status-warning); }
      &.high { color: var(--status-danger); }
      &.critical { color: #ff4444; }
    }

    .score-label {
      color: var(--text-muted);
      margin-top: var(--spacing-sm);
    }

    .risk-badge {
      display: inline-block;
      margin-top: var(--spacing-md);
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 700;
    }

    .factors-section h4, .explanation-section h4 {
      font-size: 1rem;
      margin-bottom: var(--spacing-md);
    }

    .factors-list {
      list-style: none;
      padding: 0;
      li {
        padding: var(--spacing-sm);
        background: rgba(245, 158, 11, 0.1);
        border-radius: var(--radius-sm);
        margin-bottom: var(--spacing-xs);
        font-size: 0.875rem;
      }
    }

    .explanation-text {
      background: var(--bg-secondary);
      padding: var(--spacing-md);
      border-radius: var(--radius-md);
      line-height: 1.7;
    }

    /* Create Form */
    .create-form {
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--spacing-md);
      }
      .full-width { grid-column: span 2; }
    }

    .modal-actions {
      display: flex;
      gap: var(--spacing-md);
      justify-content: flex-end;
      margin-top: var(--spacing-lg);
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--border-subtle);
    }

    .btn-success {
      background: var(--status-success);
      color: white;
      &:hover { background: #16a34a; }
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

    @media (max-width: 768px) {
      .filters-bar { flex-direction: column; }
      .filter-group { width: 100%; }
      .create-form .form-grid { grid-template-columns: 1fr; }
      .create-form .full-width { grid-column: span 1; }
    }
  `]
})
export class TransactionsComponent implements OnInit {
  transactionService = inject(TransactionService);
  authService = inject(AuthService);

  // Filters
  searchTerm = '';
  statusFilter = '';
  suspiciousFilter = '';
  minAmount: number | null = null;
  maxAmount: number | null = null;
  currentSort = 'transaction_date';
  sortOrder: 'asc' | 'desc' = 'desc';
  currentPage = 1;

  // Modals
  showDetailsModal = signal(false);
  showAnalysisModal = signal(false);
  showCreateModal = signal(false);
  selectedTransaction = signal<Transaction | null>(null);
  analysisResult = signal<AnalysisResponse | null>(null);
  isAnalyzing = signal(false);
  isCreating = signal(false);

  // New transaction form
  newTransaction = {
    amount: 0,
    currency: 'EUR',
    transaction_type: 'virement',
    channel: 'web',
    sender_name: '',
    sender_account: '',
    receiver_name: '',
    receiver_account: '',
    country_origin: 'FRA',
    country_destination: 'FRA',
    description: '',
    transaction_date: new Date().toISOString()
  };

  ngOnInit() {
    this.loadTransactions();
    this.transactionService.loadStats().subscribe();
  }

  loadTransactions() {
    this.transactionService.loadTransactions({
      page: this.currentPage,
      page_size: 15,
      status: this.statusFilter || undefined,
      is_suspicious: this.suspiciousFilter === '' ? undefined : this.suspiciousFilter === 'true',
      search: this.searchTerm || undefined,
      min_amount: this.minAmount || undefined,
      max_amount: this.maxAmount || undefined,
      sort_by: this.currentSort,
      sort_order: this.sortOrder
    }).subscribe();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadTransactions();
  }

  sortBy(column: string) {
    if (this.currentSort === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort = column;
      this.sortOrder = 'desc';
    }
    this.loadTransactions();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadTransactions();
  }

  getPageNumbers(): number[] {
    const total = this.transactionService.totalPages();
    const current = this.currentPage;
    const pages: number[] = [];
    
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.push(i);
    }
    return pages;
  }

  viewDetails(tx: Transaction) {
    this.selectedTransaction.set(tx);
    this.showDetailsModal.set(true);
  }

  analyzeTransaction(tx: Transaction) {
    this.selectedTransaction.set(tx);
    this.analysisResult.set(null);
    this.showAnalysisModal.set(true);
    this.isAnalyzing.set(true);

    this.transactionService.analyzeTransaction(tx.id).subscribe({
      next: (result) => {
        this.analysisResult.set(result);
        this.isAnalyzing.set(false);
        this.transactionService.loadStats().subscribe();
      },
      error: () => {
        this.isAnalyzing.set(false);
      }
    });
  }

  reviewTransaction(tx: Transaction, isFraud: boolean) {
    this.transactionService.reviewTransaction(tx.id, isFraud).subscribe({
      next: () => {
        this.loadTransactions();
        this.transactionService.loadStats().subscribe();
      }
    });
  }

  confirmReview(isFraud: boolean) {
    const tx = this.selectedTransaction();
    if (tx) {
      this.transactionService.reviewTransaction(tx.id, isFraud).subscribe({
        next: () => {
          this.closeModals();
          this.loadTransactions();
          this.transactionService.loadStats().subscribe();
        }
      });
    }
  }

  createTransaction() {
    this.isCreating.set(true);
    this.transactionService.createTransaction(this.newTransaction).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.closeModals();
        this.loadTransactions();
        this.transactionService.loadStats().subscribe();
        this.resetNewTransaction();
      },
      error: () => {
        this.isCreating.set(false);
      }
    });
  }

  resetNewTransaction() {
    this.newTransaction = {
      amount: 0,
      currency: 'EUR',
      transaction_type: 'virement',
      channel: 'web',
      sender_name: '',
      sender_account: '',
      receiver_name: '',
      receiver_account: '',
      country_origin: 'FRA',
      country_destination: 'FRA',
      description: '',
      transaction_date: new Date().toISOString()
    };
  }

  closeModals() {
    this.showDetailsModal.set(false);
    this.showAnalysisModal.set(false);
    this.showCreateModal.set(false);
    this.showActionModal.set(false);
  }

  // ============================================
  // NOUVELLES ACTIONS FRAUDE
  // ============================================

  showActionModal = signal(false);
  actionResult = signal<any>(null);
  actionType = signal<string>('');
  isActionLoading = signal(false);

  blockTransaction(tx: Transaction) {
    if (!confirm(`Voulez-vous BLOQUER la transaction ${tx.transaction_ref} de ${this.formatCurrency(tx.amount)} ?`)) {
      return;
    }
    
    this.isActionLoading.set(true);
    this.transactionService.blockTransaction(tx.id).subscribe({
      next: (result) => {
        this.isActionLoading.set(false);
        this.actionResult.set(result);
        this.actionType.set('block');
        this.showActionModal.set(true);
        this.loadTransactions();
        this.transactionService.loadStats().subscribe();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert('Erreur lors du blocage: ' + (err.error?.detail || 'Erreur inconnue'));
      }
    });
  }

  createTicket(tx: Transaction) {
    if (!confirm(`Voulez-vous ouvrir un TICKET FRAUDE pour la transaction ${tx.transaction_ref} ?`)) {
      return;
    }
    
    this.isActionLoading.set(true);
    this.transactionService.createFraudTicket(tx.id).subscribe({
      next: (result) => {
        this.isActionLoading.set(false);
        this.actionResult.set(result);
        this.actionType.set('ticket');
        this.showActionModal.set(true);
        this.loadTransactions();
        this.transactionService.loadStats().subscribe();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert('Erreur lors de la création du ticket: ' + (err.error?.detail || 'Erreur inconnue'));
      }
    });
  }

  callClient(tx: Transaction) {
    if (!confirm(`Voulez-vous enregistrer une demande d'APPEL CLIENT pour ${tx.sender_name || 'le client'} ?`)) {
      return;
    }
    
    this.isActionLoading.set(true);
    this.transactionService.callClient(tx.id).subscribe({
      next: (result) => {
        this.isActionLoading.set(false);
        this.actionResult.set(result);
        this.actionType.set('call');
        this.showActionModal.set(true);
        this.loadTransactions();
        this.transactionService.loadStats().subscribe();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert('Erreur: ' + (err.error?.detail || 'Erreur inconnue'));
      }
    });
  }

  approveTransaction(tx: Transaction) {
    if (!confirm(`Confirmer que la transaction ${tx.transaction_ref} est une FAUSSE ALERTE et l'approuver ?`)) {
      return;
    }
    
    this.isActionLoading.set(true);
    this.transactionService.approveTransaction(tx.id).subscribe({
      next: (result) => {
        this.isActionLoading.set(false);
        this.actionResult.set(result);
        this.actionType.set('approve');
        this.showActionModal.set(true);
        this.loadTransactions();
        this.transactionService.loadStats().subscribe();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert('Erreur: ' + (err.error?.detail || 'Erreur inconnue'));
      }
    });
  }

  // Helpers
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(date));
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'virement': '↔️', 'carte': '💳', 'prelevement': '📤', 'retrait': '🏧', 'depot': '📥'
    };
    return icons[type] || '💰';
  }

  getScoreClass(score: number | null): string {
    if (score === null) return '';
    if (score >= 85) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getStatusClass(status: string): string {
    return status;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'En attente',
      'analyzed': 'Analysé',
      'confirmed_fraud': 'Fraude',
      'cleared': 'Validé',
      'under_investigation': 'Enquête',
      'pending_call': 'Appel client',
      'blocked': 'Bloqué'
    };
    return labels[status] || status;
  }

  getActionTitle(): string {
    const titles: Record<string, string> = {
      'block': '🚫 Transaction Bloquée',
      'ticket': '🎫 Ticket Fraude Créé',
      'call': '📞 Appel Client Demandé',
      'approve': '✅ Transaction Approuvée'
    };
    return titles[this.actionType()] || 'Action effectuée';
  }
}
