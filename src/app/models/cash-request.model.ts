export interface CashRequest {
  id: string;
  requesterName: string;
  requesterId: string;
  department: string;
  bankNotes: BankNote[];
  coinsRequested?: boolean;
  dyePackRequired?: boolean;
  dateRequested: Date;
  expectedReturnDate?: Date;
  actualReturnDate?: Date;
  issuedBy?: string;
  issuedTo?: string;
  cashCountedBeforeIssuance?: boolean;
  cashCountedOnReturn?: boolean;
  cashReceivedBy?: string;
  comments?: string;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;

  // Approval details
  approvedBy?: string;
  dateApproved?: Date;

  // Cancellation details
  dateCancelled?: Date;
  cancellationReason?: string;
  cancelledBy?: string;
  isAutoCancelled?: boolean;

  // Rejection details
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedDate?: Date;
  isAutoRejected?: boolean;
}

export interface BankNote {
  denomination: NoteDenomination;
  quantity: number;
  series?: import('./inventory.model').NoteSeries; // Optional series selection for smart requesting
}

export enum NoteDenomination {
  R10 = 10,
  R20 = 20,
  R50 = 50,
  R100 = 100,
  R200 = 200
}

export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ISSUED = 'issued',
  RETURNED = 'returned',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected'
}

export interface CashRequestSummary {
  totalAmount: number;
  noteBreakdown: BankNote[];
}

export interface InventoryAvailability {
  denomination: NoteDenomination;
  status: InventoryStatus;
  totalAvailable?: number; // Only visible to approvers
}

export interface SeriesInventoryAvailability {
  denomination: NoteDenomination;
  series: import('./inventory.model').NoteSeries;
  status: InventoryStatus;
  available: number;
  isRecommended?: boolean; // Indicates if this series is recommended for the denomination
}

export enum InventoryStatus {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock'
}

export interface InventoryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  inventoryPreview?: InventoryPreviewItem[];
}

export interface InventoryPreviewItem {
  denomination: NoteDenomination;
  currentQuantity: number;
  requestedQuantity: number;
  remainingAfterApproval: number;
  series: string;
}

export interface RejectionResult {
  isRejected: boolean;
  reason: string;
  insufficientDenominations: {
    denomination: NoteDenomination;
    requested: number;
    available: number;
    shortage: number;
  }[];
  suggestedAlternatives?: string[];
}
