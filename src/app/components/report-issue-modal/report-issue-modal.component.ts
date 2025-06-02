import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  IssueCategory,
  IssuePriority,
  ISSUE_CATEGORY_LABELS,
  ISSUE_PRIORITY_LABELS
} from '../../models/issue.model';
import { IssueService } from '../../services/issue.service';
import { UserService } from '../../services/user.service';
import { CashRequest } from '../../models/cash-request.model';

export interface ReportIssueDialogData {
  requestId?: string;
  request?: CashRequest;
}

@Component({
  selector: 'app-report-issue-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './report-issue-modal.component.html',
  styleUrls: ['./report-issue-modal.component.scss']
})
export class ReportIssueModalComponent implements OnInit {
  issueForm: FormGroup;
  isSubmitting = false;

  categories = Object.entries(ISSUE_CATEGORY_LABELS).map(([value, label]) => ({
    value: value as IssueCategory,
    label
  }));

  priorities = Object.entries(ISSUE_PRIORITY_LABELS).map(([value, label]) => ({
    value: value as IssuePriority,
    label
  }));

  constructor(
    private dialogRef: MatDialogRef<ReportIssueModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportIssueDialogData,
    private fb: FormBuilder,
    private issueService: IssueService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.issueForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      category: ['', Validators.required],
      priority: [IssuePriority.MEDIUM, Validators.required],
      description: ['', [Validators.required, Validators.minLength(20)]]
    });
  }

  ngOnInit(): void {
    // Pre-fill some fields based on context if available
    if (this.data?.request) {
      // Could pre-select category based on request context
    }
  }

  getCategoryIcon(category: IssueCategory): string {
    const iconMap: { [key in IssueCategory]: string } = {
      [IssueCategory.MISSING_NOTES]: 'money_off',
      [IssueCategory.DAMAGED_NOTES]: 'broken_image',
      [IssueCategory.COUNTERFEIT_NOTES]: 'security',
      [IssueCategory.COUNTING_DISCREPANCY]: 'calculate',
      [IssueCategory.EQUIPMENT_MALFUNCTION]: 'build',
      [IssueCategory.SECURITY_CONCERN]: 'shield',
      [IssueCategory.PROCESS_VIOLATION]: 'rule',
      [IssueCategory.OTHER]: 'help'
    };
    return iconMap[category] || 'help';
  }

  getPriorityIcon(priority: IssuePriority): string {
    const iconMap: { [key in IssuePriority]: string } = {
      [IssuePriority.CRITICAL]: 'error',
      [IssuePriority.HIGH]: 'warning',
      [IssuePriority.MEDIUM]: 'info',
      [IssuePriority.LOW]: 'help'
    };
    return iconMap[priority] || 'info';
  }

  calculateTotal(request: CashRequest): number {
    return request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  onSubmit(): void {
    if (this.issueForm.invalid) {
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.issueForm.value;
      const issue = this.issueService.createIssue({
        title: formValue.title,
        description: formValue.description,
        category: formValue.category,
        priority: formValue.priority,
        requestId: this.data?.requestId
      });

      this.snackBar.open('Issue reported successfully. Managers have been notified.', 'Close', {
        duration: 5000
      });

      this.dialogRef.close({ success: true, issue });
    } catch (error) {
      console.error('Error reporting issue:', error);
      this.snackBar.open('Failed to report issue. Please try again.', 'Close', {
        duration: 3000
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }
}
