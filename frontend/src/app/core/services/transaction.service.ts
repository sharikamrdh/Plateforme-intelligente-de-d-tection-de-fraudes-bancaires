import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@environments/environment';

export interface Transaction {
  id: string;
  transaction_ref: string;
  amount: number;
  currency: string;
  sender_account: string;
  receiver_account: string;
  sender_name: string;
  receiver_name: string;
  transaction_type: string;
  channel: string;
  country_origin: string;
  country_destination: string;
  ip_address: string;
  device_id: string;
  merchant_category: string;
  description: string;
  transaction_date: string;
  created_at: string;
  fraud_score: number | null;
  is_suspicious: boolean;
  is_confirmed_fraud: boolean;
  analysis_date: string | null;
  ai_explanation: string | null;
  status: 'pending' | 'analyzed' | 'reviewed' | 'confirmed_fraud' | 'cleared';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionStats {
  total_transactions: number;
  suspicious_count: number;
  confirmed_fraud_count: number;
  pending_review: number;
  average_fraud_score: number | null;
  total_fraud_amount: number | null;
  transactions_today: number;
  high_risk_count: number;
}

export interface DailyStats {
  date: string;
  total: number;
  suspicious: number;
  fraud_amount: number;
}

export interface AnalysisResponse {
  transaction_id: string;
  transaction_ref: string;
  fraud_score: number;
  is_suspicious: boolean;
  risk_level: string;
  ai_explanation: string;
  analysis_date: string;
  factors: string[];
}

export interface TransactionFilters {
  page?: number;
  page_size?: number;
  status?: string;
  is_suspicious?: boolean;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = environment.apiUrl;

  // State signals
  private _transactions = signal<Transaction[]>([]);
  private _stats = signal<TransactionStats | null>(null);
  private _dailyStats = signal<DailyStats[]>([]);
  private _isLoading = signal(false);
  private _totalCount = signal(0);
  private _currentPage = signal(1);
  private _totalPages = signal(1);

  // Public computed signals
  transactions = computed(() => this._transactions());
  stats = computed(() => this._stats());
  dailyStats = computed(() => this._dailyStats());
  isLoading = computed(() => this._isLoading());
  totalCount = computed(() => this._totalCount());
  currentPage = computed(() => this._currentPage());
  totalPages = computed(() => this._totalPages());

  constructor(private http: HttpClient) {}

  loadTransactions(filters: TransactionFilters = {}): Observable<TransactionListResponse> {
    this._isLoading.set(true);

    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<TransactionListResponse>(`${this.apiUrl}/transactions`, { params }).pipe(
      tap(response => {
        this._transactions.set(response.items);
        this._totalCount.set(response.total);
        this._currentPage.set(response.page);
        this._totalPages.set(response.total_pages);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        return throwError(() => error);
      })
    );
  }

  getTransaction(id: string): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.apiUrl}/transactions/${id}`);
  }

  analyzeTransaction(id: string, forceReanalysis = false): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(
      `${this.apiUrl}/transactions/${id}/analyze`,
      { force_reanalysis: forceReanalysis }
    ).pipe(
      tap(response => {
        // Update the transaction in the list
        this._transactions.update(transactions =>
          transactions.map(t =>
            t.id === id
              ? {
                  ...t,
                  fraud_score: response.fraud_score,
                  is_suspicious: response.is_suspicious,
                  ai_explanation: response.ai_explanation,
                  analysis_date: response.analysis_date,
                  status: 'analyzed' as const
                }
              : t
          )
        );
      })
    );
  }

  reviewTransaction(id: string, isConfirmedFraud: boolean, notes?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/review`, {
      is_confirmed_fraud: isConfirmedFraud,
      review_notes: notes
    }).pipe(
      tap(() => {
        // Update the transaction in the list
        this._transactions.update(transactions =>
          transactions.map(t =>
            t.id === id
              ? {
                  ...t,
                  is_confirmed_fraud: isConfirmedFraud,
                  status: isConfirmedFraud ? 'confirmed_fraud' as const : 'cleared' as const
                }
              : t
          )
        );
      })
    );
  }

  loadStats(): Observable<TransactionStats> {
    return this.http.get<TransactionStats>(`${this.apiUrl}/transactions/stats`).pipe(
      tap(stats => this._stats.set(stats))
    );
  }

  loadDailyStats(days = 7): Observable<DailyStats[]> {
    return this.http.get<DailyStats[]>(`${this.apiUrl}/transactions/daily-stats`, {
      params: { days: days.toString() }
    }).pipe(
      tap(stats => this._dailyStats.set(stats))
    );
  }

  createTransaction(data: Partial<Transaction>): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/transactions`, data);
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/transactions/${id}`).pipe(
      tap(() => {
        this._transactions.update(transactions =>
          transactions.filter(t => t.id !== id)
        );
        this._totalCount.update(count => count - 1);
      })
    );
  }

  // ==========================================
  // NOUVELLES ACTIONS FRAUDE
  // ==========================================

  /**
   * BLOQUER une transaction suspecte
   * Bloque immédiatement le virement et le marque comme fraude confirmée
   */
  blockTransaction(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/block`, {}).pipe(
      tap((response: any) => {
        this._transactions.update(transactions =>
          transactions.map(t =>
            t.id === id
              ? { ...t, status: 'confirmed_fraud' as const, is_confirmed_fraud: true }
              : t
          )
        );
      })
    );
  }

  /**
   * OUVRIR UN TICKET FRAUDE
   * Crée un ticket d'investigation pour l'équipe Conformité/Fraude
   */
  createFraudTicket(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/ticket`, {}).pipe(
      tap((response: any) => {
        this._transactions.update(transactions =>
          transactions.map(t =>
            t.id === id
              ? { ...t, status: 'under_investigation' as any }
              : t
          )
        );
      })
    );
  }

  /**
   * APPELER LE CLIENT
   * Enregistre une demande d'appel client pour vérification
   */
  callClient(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/call-client`, {}).pipe(
      tap((response: any) => {
        this._transactions.update(transactions =>
          transactions.map(t =>
            t.id === id
              ? { ...t, status: 'pending_call' as any }
              : t
          )
        );
      })
    );
  }

  /**
   * APPROUVER (Fausse alerte)
   * Approuve la transaction et la marque comme fausse alerte
   */
  approveTransaction(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/approve`, {}).pipe(
      tap((response: any) => {
        this._transactions.update(transactions =>
          transactions.map(t =>
            t.id === id
              ? { ...t, status: 'cleared' as const, is_confirmed_fraud: false }
              : t
          )
        );
      })
    );
  }

  /**
   * Enregistrer le résultat d'un appel client
   */
  recordCallResult(id: string, confirmedByClient: boolean, notes: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/call-result`, {
      confirmed_by_client: confirmedByClient,
      notes: notes
    });
  }

  // ==========================================
  // ANALYSES EN COURS
  // ==========================================

  /**
   * Récupère les transactions en cours d'analyse
   */
  getAnalyzingTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions/analysis/in-progress`);
  }

  /**
   * Démarre l'analyse d'une transaction (statut = analyzing)
   */
  startAnalysis(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions/${id}/start-analysis`, {});
  }

  // Helper methods
  getRiskLevel(score: number | null): string {
    if (score === null) return 'unknown';
    if (score >= 85) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getRiskColor(score: number | null): string {
    if (score === null) return 'var(--text-muted)';
    if (score >= 85) return 'var(--status-critical)';
    if (score >= 70) return 'var(--status-danger)';
    if (score >= 50) return 'var(--status-warning)';
    return 'var(--status-success)';
  }

  formatCurrency(amount: number, currency = 'EUR'): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  }
}
