import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '@app/shared/components/navbar/navbar.component';
import { ModalComponent } from '@app/shared/components/modal/modal.component';
import { TransactionService, Transaction, AnalysisResponse } from '@app/core/services/transaction.service';
import { AuthService } from '@app/core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, ModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  transactionService = inject(TransactionService);
  authService = inject(AuthService);

  // Filters
  filters = signal({
    page: 1,
    page_size: 10,
    status: '',
    is_suspicious: undefined as boolean | undefined,
    search: '',
    sort_by: 'transaction_date',
    sort_order: 'desc' as 'asc' | 'desc'
  });

  // Modal states
  showAnalysisModal = signal(false);
  selectedTransaction = signal<Transaction | null>(null);
  analysisResult = signal<AnalysisResponse | null>(null);
  isAnalyzing = signal(false);

  // Review modal
  showReviewModal = signal(false);
  reviewNotes = '';

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.transactionService.loadTransactions(this.filters()).subscribe();
    this.transactionService.loadStats().subscribe();
    this.transactionService.loadDailyStats(7).subscribe();
  }

  onFilterChange(): void {
    this.filters.update(f => ({ ...f, page: 1 }));
    this.transactionService.loadTransactions(this.filters()).subscribe();
  }

  onPageChange(page: number): void {
    this.filters.update(f => ({ ...f, page }));
    this.transactionService.loadTransactions(this.filters()).subscribe();
  }

  onSortChange(column: string): void {
    this.filters.update(f => ({
      ...f,
      sort_by: column,
      sort_order: f.sort_by === column && f.sort_order === 'desc' ? 'asc' : 'desc'
    }));
    this.transactionService.loadTransactions(this.filters()).subscribe();
  }

  analyzeTransaction(transaction: Transaction): void {
    this.selectedTransaction.set(transaction);
    this.analysisResult.set(null);
    this.showAnalysisModal.set(true);
    this.isAnalyzing.set(true);

    this.transactionService.analyzeTransaction(transaction.id).subscribe({
      next: (result) => {
        this.analysisResult.set(result);
        this.isAnalyzing.set(false);
      },
      error: () => {
        this.isAnalyzing.set(false);
      }
    });
  }

  openReviewModal(transaction: Transaction): void {
    this.selectedTransaction.set(transaction);
    this.reviewNotes = '';
    this.showReviewModal.set(true);
  }

  submitReview(isConfirmedFraud: boolean): void {
    const transaction = this.selectedTransaction();
    if (!transaction) return;

    this.transactionService.reviewTransaction(
      transaction.id,
      isConfirmedFraud,
      this.reviewNotes
    ).subscribe({
      next: () => {
        this.showReviewModal.set(false);
        this.transactionService.loadStats().subscribe();
      }
    });
  }

  closeModals(): void {
    this.showAnalysisModal.set(false);
    this.showReviewModal.set(false);
    this.selectedTransaction.set(null);
    this.analysisResult.set(null);
  }

  // Helper methods
  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'pending': 'badge-info',
      'analyzed': 'badge-warning',
      'reviewed': 'badge-success',
      'confirmed_fraud': 'badge-danger',
      'cleared': 'badge-success'
    };
    return classes[status] || 'badge-info';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'En attente',
      'analyzed': 'Analysé',
      'reviewed': 'Revu',
      'confirmed_fraud': 'Fraude confirmée',
      'cleared': 'Validé'
    };
    return labels[status] || status;
  }

  getRiskBadgeClass(score: number | null): string {
    if (score === null) return '';
    if (score >= 85) return 'badge-critical';
    if (score >= 70) return 'badge-danger';
    if (score >= 50) return 'badge-warning';
    return 'badge-success';
  }

  formatCurrency(amount: number): string {
    return this.transactionService.formatCurrency(amount);
  }

  formatDate(date: string): string {
    return this.transactionService.formatDate(date);
  }

  getTransactionTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'virement': '↔️',
      'carte': '💳',
      'prelevement': '📤',
      'retrait': '🏧',
      'depot': '📥'
    };
    return icons[type] || '💰';
  }
}
