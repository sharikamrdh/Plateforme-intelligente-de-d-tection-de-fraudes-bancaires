import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '@app/shared/components/navbar/navbar.component';
import { TransactionService, Transaction } from '@app/core/services/transaction.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  template: `
    <div class="analysis-page">
      <app-navbar></app-navbar>

      <main class="page-content">
        <!-- Header -->
        <header class="page-header">
          <div class="header-info">
            <h1 class="page-title">
              <span class="pulse-icon">🔬</span>
              Analyses en cours
            </h1>
            <p class="page-subtitle">Suivi en temps réel des analyses IA de transactions</p>
          </div>
          <div class="header-actions">
            <div class="auto-refresh" [class.active]="autoRefresh()">
              <span class="refresh-indicator"></span>
              Actualisation auto: {{ autoRefresh() ? 'ON' : 'OFF' }}
            </div>
            <button class="btn btn-secondary" (click)="toggleAutoRefresh()">
              @if (autoRefresh()) {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Reprendre
              }
            </button>
            <button class="btn btn-primary" (click)="loadAnalyzingTransactions()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Actualiser
            </button>
          </div>
        </header>

        <!-- Stats -->
        <div class="stats-bar">
          <div class="stat-card analyzing">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ analyzingTransactions().length }}</span>
              <span class="stat-label">En cours d'analyse</span>
            </div>
          </div>
          <div class="stat-card completed">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ completedCount() }}</span>
              <span class="stat-label">Terminées (session)</span>
            </div>
          </div>
          <div class="stat-card time">
            <div class="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">~3s</span>
              <span class="stat-label">Temps moyen</span>
            </div>
          </div>
        </div>

        <!-- Liste des analyses en cours -->
        <div class="analysis-list card">
          <div class="list-header">
            <h2>Transactions en cours d'analyse</h2>
            <span class="count-badge">{{ analyzingTransactions().length }}</span>
          </div>

          @if (isLoading()) {
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Chargement des analyses...</p>
            </div>
          } @else if (analyzingTransactions().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3>Aucune analyse en cours</h3>
              <p>Les transactions en cours d'analyse apparaîtront ici automatiquement.</p>
              <a routerLink="/transactions" class="btn btn-primary">
                Voir les transactions
              </a>
            </div>
          } @else {
            <div class="transactions-grid">
              @for (tx of analyzingTransactions(); track tx.id) {
                <div class="analysis-card">
                  <div class="card-header">
                    <span class="tx-ref">{{ tx.transaction_ref }}</span>
                    <span class="status-badge analyzing">
                      <span class="pulse-dot"></span>
                      En cours
                    </span>
                  </div>
                  
                  <div class="card-body">
                    <div class="tx-amount">{{ formatCurrency(tx.amount) }}</div>
                    <div class="tx-details">
                      <div class="detail-row">
                        <span class="label">De:</span>
                        <span class="value">{{ tx.sender_name || 'N/A' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="label">Vers:</span>
                        <span class="value">{{ tx.receiver_name || 'N/A' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="label">Pays:</span>
                        <span class="value">{{ tx.country_origin }} → {{ tx.country_destination }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="label">Type:</span>
                        <span class="value">{{ tx.transaction_type }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="card-footer">
                    <div class="progress-section">
                      <div class="progress-bar">
                        <div class="progress-fill" [style.animation-duration]="'3s'"></div>
                      </div>
                      <span class="progress-text">Analyse IA en cours...</span>
                    </div>
                    <div class="analysis-steps">
                      <div class="step completed">
                        <span class="step-icon">✓</span>
                        <span class="step-label">Réception</span>
                      </div>
                      <div class="step active">
                        <span class="step-icon">
                          <span class="mini-spinner"></span>
                        </span>
                        <span class="step-label">ML Analysis</span>
                      </div>
                      <div class="step">
                        <span class="step-icon">○</span>
                        <span class="step-label">LLM</span>
                      </div>
                      <div class="step">
                        <span class="step-icon">○</span>
                        <span class="step-label">Résultat</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Historique des analyses récentes -->
        <div class="recent-analyses card">
          <div class="list-header">
            <h2>Analyses récentes terminées</h2>
          </div>
          
          @if (recentCompleted().length === 0) {
            <div class="empty-mini">
              <p>Les analyses terminées apparaîtront ici</p>
            </div>
          } @else {
            <div class="recent-list">
              @for (tx of recentCompleted(); track tx.id) {
                <div class="recent-item" [class.suspicious]="tx.is_suspicious">
                  <div class="recent-info">
                    <span class="recent-ref">{{ tx.transaction_ref }}</span>
                    <span class="recent-amount">{{ formatCurrency(tx.amount) }}</span>
                  </div>
                  <div class="recent-result">
                    @if (tx.fraud_score !== null) {
                      <span class="score-badge" [class]="getScoreClass(tx.fraud_score)">
                        {{ tx.fraud_score }}%
                      </span>
                    }
                    <span class="result-status">
                      @if (tx.is_suspicious) {
                        ⚠️ Suspect
                      } @else {
                        ✅ Normal
                      }
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Console de logs (simulation) -->
        <div class="logs-console card">
          <div class="console-header">
            <h2>🖥️ Console Backend (temps réel)</h2>
            <span class="console-indicator">
              <span class="blink-dot"></span>
              Connecté
            </span>
          </div>
          <div class="console-body">
            @for (log of consoleLogs(); track $index) {
              <div class="log-line" [class]="log.type">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
            }
            @if (consoleLogs().length === 0) {
              <div class="log-line info">
                <span class="log-time">--:--:--</span>
                <span class="log-message">En attente de nouvelles analyses...</span>
              </div>
            }
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .analysis-page {
      min-height: 100vh;
      background: var(--bg-primary);
    }

    .page-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: var(--spacing-lg);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-xl);
      flex-wrap: wrap;
      gap: var(--spacing-md);
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .pulse-icon {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .page-subtitle {
      color: var(--text-muted);
      margin-top: var(--spacing-xs);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    .auto-refresh {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      color: var(--text-muted);

      &.active {
        color: var(--accent-primary);
      }

      .refresh-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted);
      }

      &.active .refresh-indicator {
        background: var(--accent-primary);
        animation: blink 1s infinite;
      }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Stats bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);

      .stat-icon {
        width: 48px;
        height: 48px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &.analyzing .stat-icon {
        background: rgba(59, 130, 246, 0.2);
        color: var(--status-info);
      }

      &.completed .stat-icon {
        background: rgba(34, 197, 94, 0.2);
        color: var(--status-success);
      }

      &.time .stat-icon {
        background: rgba(168, 85, 247, 0.2);
        color: #a855f7;
      }

      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        display: block;
      }

      .stat-label {
        font-size: 0.875rem;
        color: var(--text-muted);
      }
    }

    /* Analysis list */
    .analysis-list {
      margin-bottom: var(--spacing-xl);
    }

    .list-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--border-subtle);

      h2 {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0;
      }

      .count-badge {
        background: var(--accent-primary);
        color: var(--bg-primary);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 600;
      }
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-2xl);
      text-align: center;
    }

    .empty-icon {
      color: var(--text-muted);
      opacity: 0.5;
      margin-bottom: var(--spacing-md);
    }

    .empty-state h3 {
      margin-bottom: var(--spacing-sm);
    }

    .empty-state p {
      color: var(--text-muted);
      margin-bottom: var(--spacing-lg);
    }

    /* Transaction grid */
    .transactions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: var(--spacing-lg);
      padding: var(--spacing-lg);
    }

    .analysis-card {
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
      overflow: hidden;
      transition: all 0.3s ease;

      &:hover {
        border-color: var(--accent-primary);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        background: var(--bg-tertiary);
        border-bottom: 1px solid var(--border-subtle);
      }

      .tx-ref {
        font-family: monospace;
        font-weight: 600;
        color: var(--accent-primary);
      }

      .status-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 600;

        &.analyzing {
          background: rgba(59, 130, 246, 0.2);
          color: var(--status-info);
        }
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--status-info);
        animation: pulse 1.5s infinite;
      }

      .card-body {
        padding: var(--spacing-md);
      }

      .tx-amount {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: var(--spacing-md);
      }

      .tx-details {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.875rem;

        .label {
          color: var(--text-muted);
        }

        .value {
          color: var(--text-primary);
          font-weight: 500;
        }
      }

      .card-footer {
        padding: var(--spacing-md);
        border-top: 1px solid var(--border-subtle);
      }

      .progress-section {
        margin-bottom: var(--spacing-md);
      }

      .progress-bar {
        height: 4px;
        background: var(--bg-tertiary);
        border-radius: var(--radius-full);
        overflow: hidden;
        margin-bottom: var(--spacing-xs);
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-primary), var(--status-info));
        border-radius: var(--radius-full);
        animation: progress-animation 3s ease-in-out infinite;
      }

      @keyframes progress-animation {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 100%; }
      }

      .progress-text {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .analysis-steps {
        display: flex;
        justify-content: space-between;
      }

      .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        color: var(--text-muted);

        .step-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
        }

        &.completed .step-icon {
          background: var(--status-success);
          color: white;
        }

        &.active .step-icon {
          background: var(--status-info);
          color: white;
        }

        &.active .step-label {
          color: var(--status-info);
          font-weight: 600;
        }
      }

      .mini-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid transparent;
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    }

    /* Recent analyses */
    .recent-analyses {
      margin-bottom: var(--spacing-xl);
    }

    .empty-mini {
      padding: var(--spacing-lg);
      text-align: center;
      color: var(--text-muted);
    }

    .recent-list {
      padding: var(--spacing-md);
    }

    .recent-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-xs);

      &:hover {
        background: var(--bg-secondary);
      }

      &.suspicious {
        border-left: 3px solid var(--status-warning);
      }

      .recent-info {
        display: flex;
        gap: var(--spacing-md);
        align-items: center;
      }

      .recent-ref {
        font-family: monospace;
        font-size: 0.875rem;
      }

      .recent-amount {
        font-weight: 600;
      }

      .recent-result {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }

      .score-badge {
        padding: 2px 8px;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;

        &.low { background: rgba(34, 197, 94, 0.2); color: var(--status-success); }
        &.medium { background: rgba(245, 158, 11, 0.2); color: var(--status-warning); }
        &.high { background: rgba(249, 115, 22, 0.2); color: #f97316; }
        &.critical { background: rgba(239, 68, 68, 0.2); color: var(--status-danger); }
      }

      .result-status {
        font-size: 0.875rem;
      }
    }

    /* Logs console */
    .logs-console {
      background: #1a1a2e;
      border: 1px solid #2d2d44;
    }

    .console-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-md) var(--spacing-lg);
      background: #0f0f1a;
      border-bottom: 1px solid #2d2d44;

      h2 {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0;
        color: #a0a0b0;
      }

      .console-indicator {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-size: 0.75rem;
        color: var(--status-success);
      }

      .blink-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--status-success);
        animation: blink 1s infinite;
      }
    }

    .console-body {
      padding: var(--spacing-md);
      max-height: 300px;
      overflow-y: auto;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.75rem;
      line-height: 1.6;
    }

    .log-line {
      display: flex;
      gap: var(--spacing-md);

      .log-time {
        color: #666;
        min-width: 80px;
      }

      .log-message {
        color: #a0a0b0;
      }

      &.info .log-message { color: #60a5fa; }
      &.success .log-message { color: #4ade80; }
      &.warning .log-message { color: #fbbf24; }
      &.error .log-message { color: #f87171; }
      &.separator .log-message { color: #4b5563; }
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;

      &.btn-primary {
        background: var(--accent-primary);
        color: var(--bg-primary);
        &:hover { background: var(--accent-hover); }
      }

      &.btn-secondary {
        background: var(--bg-secondary);
        border-color: var(--border-color);
        color: var(--text-primary);
        &:hover { border-color: var(--accent-primary); }
      }
    }

    .card {
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--accent-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: var(--spacing-md);
    }
  `]
})
export class AnalysisComponent implements OnInit, OnDestroy {
  private transactionService = inject(TransactionService);
  
  analyzingTransactions = signal<Transaction[]>([]);
  recentCompleted = signal<Transaction[]>([]);
  completedCount = signal(0);
  isLoading = signal(false);
  autoRefresh = signal(true);
  consoleLogs = signal<{time: string, message: string, type: string}[]>([]);
  
  private refreshSubscription?: Subscription;

  ngOnInit() {
    this.loadAnalyzingTransactions();
    this.startAutoRefresh();
    this.addLog('info', 'Console connectée au backend...');
    this.addLog('info', 'En attente de nouvelles analyses...');
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  loadAnalyzingTransactions() {
    this.isLoading.set(true);
    
    this.transactionService.getAnalyzingTransactions().subscribe({
      next: (transactions) => {
        const previousCount = this.analyzingTransactions().length;
        this.analyzingTransactions.set(transactions);
        this.isLoading.set(false);
        
        // Check for newly completed
        if (previousCount > transactions.length) {
          const completed = previousCount - transactions.length;
          this.completedCount.update(c => c + completed);
          this.addLog('success', `✅ ${completed} analyse(s) terminée(s)`);
        }
        
        // Check for new analyses started
        if (transactions.length > previousCount) {
          const newCount = transactions.length - previousCount;
          this.addLog('info', `🚀 ${newCount} nouvelle(s) analyse(s) démarrée(s)`);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.addLog('error', `❌ Erreur: ${err.message}`);
      }
    });

    // Load recent completed for display
    this.transactionService.loadTransactions({ 
      status: 'analyzed', 
      page_size: 5,
      sort_by: 'analysis_date',
      sort_order: 'desc'
    }).subscribe({
      next: (response) => {
        this.recentCompleted.set(response.items);
      }
    });
  }

  startAutoRefresh() {
    this.refreshSubscription = interval(2000).subscribe(() => {
      if (this.autoRefresh()) {
        this.loadAnalyzingTransactions();
      }
    });
  }

  stopAutoRefresh() {
    this.refreshSubscription?.unsubscribe();
  }

  toggleAutoRefresh() {
    this.autoRefresh.update(v => !v);
    if (this.autoRefresh()) {
      this.addLog('info', '▶️ Auto-refresh activé');
    } else {
      this.addLog('warning', '⏸️ Auto-refresh en pause');
    }
  }

  addLog(type: string, message: string) {
    const time = new Date().toLocaleTimeString('fr-FR');
    this.consoleLogs.update(logs => {
      const newLogs = [...logs, { time, message, type }];
      // Keep only last 50 logs
      return newLogs.slice(-50);
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  getScoreClass(score: number | null): string {
    if (score === null) return '';
    if (score >= 85) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
}
