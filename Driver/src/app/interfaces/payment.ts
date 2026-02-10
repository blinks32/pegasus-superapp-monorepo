export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  timestamp: any;
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
  balance?: number;
}

export interface DriverWallet {
  balance: number;
  currency: string;
  lastUpdated: any;
  transactions?: WalletTransaction[];
  paymentMethods?: any[];
  isVerified: boolean;
}
