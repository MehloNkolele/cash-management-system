import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CashRequest, RequestStatus, BankNote, CashRequestSummary } from '../models/cash-request.model';
import { LocalStorageService } from './local-storage.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

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
    private userService: UserService
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

    const requests = this.getAllRequests();
    requests.push(newRequest);
    this.saveRequests(requests);

    // Send notification to issuers
    this.notificationService.notifyNewRequest(newRequest);

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

    requests[index] = updatedRequest;
    this.saveRequests(requests);

    // Handle status change notifications
    this.handleStatusChangeNotifications(updatedRequest, requests[index].status);

    return updatedRequest;
  }

  approveRequest(id: string, issuerId: string, expectedReturnDate: Date): CashRequest | null {
    const issuer = this.userService.getUserById(issuerId);
    if (!issuer) {
      throw new Error('Issuer not found');
    }

    return this.updateRequest(id, {
      status: RequestStatus.APPROVED,
      issuedBy: issuer.fullName,
      expectedReturnDate
    });
  }

  issueCash(id: string, cashCountedBeforeIssuance: boolean): CashRequest | null {
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

    if (cashCountedOnReturn && !comments) {
      updates.status = RequestStatus.COMPLETED;
    }

    return this.updateRequest(id, updates);
  }

  completeRequest(id: string): CashRequest | null {
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
    }
  }
}
