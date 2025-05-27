export interface CashRequest {
  id: string;
  requesterName: string;
  requesterId: string;
  department: string;
  bankNotes: BankNote[];
  coinsRequested?: boolean;
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
}

export interface BankNote {
  denomination: NoteDenomination;
  quantity: number;
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
  CANCELLED = 'cancelled'
}

export interface CashRequestSummary {
  totalAmount: number;
  noteBreakdown: BankNote[];
}
