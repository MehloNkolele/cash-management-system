import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CashRequest, RequestStatus, BankNote, CashRequestSummary, RejectionResult, NoteDenomination } from '../models/cash-request.model';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';
import { SystemLogService } from './system-log.service';
import { InventoryService } from './inventory.service';

@Injectable({
  providedIn: 'root'
})
export class CashRequestService {
  private readonly REQUESTS_KEY = 'cash_mgmt_requests';

  private requestsSubject = new BehaviorSubject<CashRequest[]>([]);
  public requests$ = this.requestsSubject.asObservable();

  constructor(
    private localStorageService: LocalStorageService,
    private notificationService: NotificationService,
    private userService: UserService,
    private systemLogService: SystemLogService,
    private inventoryService: InventoryService
  ) {
    this.loadRequests();
    // Set this service in the notification service to avoid circular dependency
    this.notificationService.setCashRequestService(this);
  }

  private loadRequests(): void {
    const requests = this.getAllRequests();
    this.requestsSubject.next(requests);
  }

  private generateId(): string {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getAllRequests(): CashRequest[] {
    const requests = this.localStorageService.getItem<CashRequest[]>(this.REQUESTS_KEY) || [];
    // Convert date strings back to Date objects
    return requests.map(request => ({
      ...request,
      dateRequested: new Date(request.dateRequested),
      expectedReturnDate: request.expectedReturnDate ? new Date(request.expectedReturnDate) : undefined,
      actualReturnDate: request.actualReturnDate ? new Date(request.actualReturnDate) : undefined,
      createdAt: new Date(request.createdAt),
      updatedAt: new Date(request.updatedAt)
    }));
  }

  getRequestById(id: string): CashRequest | null {
    const requests = this.getAllRequests();
    return requests.find(request => request.id === id) || null;
  }

  getRequestsByUser(userId: string): CashRequest[] {
    return this.getAllRequests().filter(request => request.requesterId === userId);
  }

  getPendingRequests(): CashRequest[] {
    return this.getAllRequests().filter(request => request.status === RequestStatus.PENDING);
  }

  getActiveRequests(): CashRequest[] {
    return this.getAllRequests().filter(request =>
      [RequestStatus.APPROVED, RequestStatus.ISSUED].includes(request.status)
    );
  }

  createRequest(requestData: Partial<CashRequest>): CashRequest {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      throw new Error('No current user found');
    }

    const newRequest: CashRequest = {
      id: this.generateId(),
      requesterName: currentUser.fullName,
      requesterId: currentUser.id,
      department: requestData.department || currentUser.department,
      bankNotes: requestData.bankNotes || [],
      dateRequested: requestData.dateRequested || new Date(),
      status: RequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...requestData
    };

    // Check for automatic rejection due to insufficient inventory
    const rejectionResult = this.checkForAutoRejection(newRequest.bankNotes);
    if (rejectionResult.isRejected) {
      newRequest.status = RequestStatus.REJECTED;
      newRequest.rejectionReason = rejectionResult.reason;
      newRequest.rejectedBy = 'System (Automatic)';
      newRequest.rejectedDate = new Date();
      newRequest.isAutoRejected = true;
    }

    const requests = this.getAllRequests();
    requests.push(newRequest);
    this.saveRequests(requests);

    // Log the cash request creation
    this.systemLogService.logCashRequest(newRequest, 'Created');

    if (newRequest.status === RequestStatus.REJECTED) {
      // Log the automatic rejection
      this.systemLogService.logCashRequest(newRequest, 'Auto-Rejected');

      // Send rejection notifications
      this.notificationService.notifyRequestRejected(newRequest, rejectionResult);
    } else {
      // Send notification to issuers for pending requests
      this.notificationService.notifyNewRequest(newRequest);
    }

    return newRequest;
  }

  updateRequest(id: string, updates: Partial<CashRequest>): CashRequest | null {
    const requests = this.getAllRequests();
    const index = requests.findIndex(request => request.id === id);

    if (index === -1) {
      return null;
    }

    const updatedRequest = {
      ...requests[index],
      ...updates,
      updatedAt: new Date()
    };

    const oldStatus = requests[index].status;
    requests[index] = updatedRequest;
    this.saveRequests(requests);

    // Log the status change
    const statusChangeMap: { [key in RequestStatus]: string } = {
      [RequestStatus.PENDING]: 'Created',
      [RequestStatus.APPROVED]: 'Approved',
      [RequestStatus.ISSUED]: 'Issued',
      [RequestStatus.RETURNED]: 'Returned',
      [RequestStatus.COMPLETED]: 'Completed',
      [RequestStatus.CANCELLED]: 'Cancelled',
      [RequestStatus.REJECTED]: 'Rejected'
    };

    if (updates.status && updates.status !== oldStatus) {
      this.systemLogService.logCashRequest(updatedRequest, statusChangeMap[updates.status]);
    }

    // Handle status change notifications
    this.handleStatusChangeNotifications(updatedRequest, oldStatus);

    return updatedRequest;
  }

  approveRequest(id: string, issuerId: string, expectedReturnDate: Date): CashRequest | null {
    const issuer = this.userService.getUserById(issuerId);
    if (!issuer) {
      throw new Error('Issuer not found');
    }

    const request = this.getRequestById(id);
    if (!request) {
      throw new Error('Request not found');
    }

    // Check inventory availability before approval
    const rejectionResult = this.checkForAutoRejection(request.bankNotes);
    if (rejectionResult.isRejected) {
      // Auto-reject the request due to insufficient inventory
      return this.updateRequest(id, {
        status: RequestStatus.REJECTED,
        rejectionReason: rejectionResult.reason,
        rejectedBy: 'System (Auto-rejection)',
        rejectedDate: new Date(),
        isAutoRejected: true
      });
    }

    return this.updateRequest(id, {
      status: RequestStatus.APPROVED,
      issuedBy: issuer.fullName,
      expectedReturnDate
    });
  }

  issueCash(id: string, cashCountedBeforeIssuance: boolean): CashRequest | null {
    const request = this.getRequestById(id);
    if (!request || request.status !== RequestStatus.APPROVED) {
      throw new Error('Request not found or not in approved status');
    }

    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      throw new Error('No current user found');
    }

    // Double-check inventory availability before issuance (in case inventory changed since approval)
    const rejectionResult = this.checkForAutoRejection(request.bankNotes);
    if (rejectionResult.isRejected) {
      // Auto-reject the request due to insufficient inventory at time of issuance
      this.updateRequest(id, {
        status: RequestStatus.REJECTED,
        rejectionReason: `Inventory insufficient at time of issuance: ${rejectionResult.reason}`,
        rejectedBy: 'System (Auto-rejection)',
        rejectedDate: new Date(),
        isAutoRejected: true
      });
      throw new Error(`Cannot issue cash: ${rejectionResult.reason}`);
    }

    // Deduct cash from inventory
    try {
      request.bankNotes.forEach(note => {
        // Remove cash from inventory using FIFO (oldest series first)
        this.inventoryService.removeCashIssuance(note.denomination, note.quantity, `Issued for request ${id}`, currentUser.fullName);
      });
    } catch (error) {
      console.error('Error removing cash from inventory:', error);
      throw new Error('Failed to update inventory during cash issuance');
    }

    // Update request status
    return this.updateRequest(id, {
      status: RequestStatus.ISSUED,
      cashCountedBeforeIssuance
    });
  }

  returnCash(id: string, cashCountedOnReturn: boolean, cashReceivedBy: string, comments?: string): CashRequest | null {
    const updates: Partial<CashRequest> = {
      status: RequestStatus.RETURNED,
      actualReturnDate: new Date(),
      cashCountedOnReturn,
      cashReceivedBy
    };

    if (comments) {
      updates.comments = comments;
    }

    // Always set to RETURNED status - managers will process and complete later
    return this.updateRequest(id, updates);
  }

  processReturn(id: string, processedBy: string, verificationComments?: string): CashRequest | null {
    const request = this.getRequestById(id);
    if (!request || request.status !== RequestStatus.RETURNED) {
      throw new Error('Request not found or not in returned status');
    }

    // Add cash back to inventory
    try {
      request.bankNotes.forEach(note => {
        // Add cash back to inventory using FIFO reverse (add to newest series first)
        this.inventoryService.addCashReturn(note.denomination, note.quantity, `Return from request ${id}`, processedBy);
      });
    } catch (error) {
      console.error('Error adding cash back to inventory:', error);
      throw new Error('Failed to update inventory during return processing');
    }

    // Complete the request
    const updates: Partial<CashRequest> = {
      status: RequestStatus.COMPLETED,
      updatedAt: new Date()
    };

    if (verificationComments) {
      updates.comments = (request.comments ? request.comments + '\n' : '') +
                        `Manager verification: ${verificationComments}`;
    }

    return this.updateRequest(id, updates);
  }

  completeRequest(id: string): CashRequest | null {
    const request = this.getRequestById(id);
    if (!request) {
      throw new Error('Request not found');
    }

    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      throw new Error('No current user found');
    }

    // If request is in RETURNED status, add cash back to inventory before completing
    if (request.status === RequestStatus.RETURNED) {
      try {
        request.bankNotes.forEach(note => {
          // Add cash back to inventory using LIFO (newest series first)
          this.inventoryService.addCashReturn(note.denomination, note.quantity, `Return completed for request ${id}`, currentUser.fullName);
        });
      } catch (error) {
        console.error('Error adding cash back to inventory:', error);
        throw new Error('Failed to update inventory during request completion');
      }
    }

    return this.updateRequest(id, {
      status: RequestStatus.COMPLETED
    });
  }



  cancelRequest(id: string, reason?: string): CashRequest | null {
    const updates: Partial<CashRequest> = {
      status: RequestStatus.CANCELLED
    };

    if (reason) {
      updates.comments = reason;
    }

    return this.updateRequest(id, updates);
  }

  rejectRequest(id: string, reason: string, rejectedBy: string): CashRequest | null {
    const updates: Partial<CashRequest> = {
      status: RequestStatus.REJECTED,
      rejectionReason: reason,
      rejectedBy: rejectedBy,
      rejectedDate: new Date(),
      isAutoRejected: false
    };

    const request = this.updateRequest(id, updates);

    if (request) {
      // Send rejection notifications
      const rejectionResult: RejectionResult = {
        isRejected: true,
        reason: reason,
        insufficientDenominations: [],
        suggestedAlternatives: ['Contact the manager for alternative arrangements', 'Reduce the requested amount', 'Try again later when inventory is replenished']
      };

      this.notificationService.notifyRequestRejected(request, rejectionResult);
    }

    return request;
  }

  private checkForAutoRejection(bankNotes: BankNote[]): RejectionResult {
    const insufficientDenominations: RejectionResult['insufficientDenominations'] = [];

    for (const note of bankNotes) {
      if (note.quantity > 0) {
        const available = this.inventoryService.getAvailableQuantity(note.denomination);
        if (note.quantity > available) {
          insufficientDenominations.push({
            denomination: note.denomination,
            requested: note.quantity,
            available: available,
            shortage: note.quantity - available
          });
        }
      }
    }

    if (insufficientDenominations.length > 0) {
      const denominationList = insufficientDenominations
        .map(d => `R${d.denomination} (requested: ${d.requested}, available: ${d.available})`)
        .join(', ');

      const reason = `Insufficient inventory for the following denominations: ${denominationList}`;

      const suggestedAlternatives = [
        'Reduce the quantities for the insufficient denominations',
        'Contact the manager for inventory replenishment',
        'Consider alternative denominations if available',
        'Submit a smaller request and follow up later'
      ];

      return {
        isRejected: true,
        reason,
        insufficientDenominations,
        suggestedAlternatives
      };
    }

    return {
      isRejected: false,
      reason: '',
      insufficientDenominations: []
    };
  }

  calculateRequestSummary(bankNotes: BankNote[]): CashRequestSummary {
    const totalAmount = bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
    return {
      totalAmount,
      noteBreakdown: bankNotes.filter(note => note.quantity > 0)
    };
  }

  private saveRequests(requests: CashRequest[]): void {
    this.localStorageService.setItem(this.REQUESTS_KEY, requests);
    this.requestsSubject.next(requests);
  }

  private handleStatusChangeNotifications(request: CashRequest, oldStatus: RequestStatus): void {
    switch (request.status) {
      case RequestStatus.APPROVED:
        this.notificationService.notifyRequestApproved(request);
        break;
      case RequestStatus.ISSUED:
        this.notificationService.notifyCashIssued(request);
        this.notificationService.scheduleReturnReminder(request);
        break;
      case RequestStatus.COMPLETED:
        this.notificationService.notifyRequestCompleted(request);
        break;
      case RequestStatus.REJECTED:
        // Rejection notifications are handled in the rejectRequest method
        // to include proper rejection details
        break;
    }
  }
}
