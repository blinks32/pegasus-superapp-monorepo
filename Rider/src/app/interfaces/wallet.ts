// Wallet System Interfaces

export interface Wallet {
  userId: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  transactionId: string;
  walletId: string;
  userId: string;
  type: 'credit' | 'debit' | 'refund' | 'cashback' | 'referral' | 'topup' | 'ride_payment';
  amount: number;
  currency: string;
  description: string;
  referenceId?: string; // rideId, referralCode, etc.
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  createdAt: Date;
  completedAt?: Date;
  metadata?: {
    rideId?: string;
    referralCode?: string;
    promoCode?: string;
    paymentMethodId?: string;
  };
}

export interface ReferralInfo {
  referralCode: string;
  userId: string;
  referredUsers: string[];
  totalEarnings: number;
  pendingEarnings: number;
  createdAt: Date;
}

export interface ReferralReward {
  referrerId: string;
  referredUserId: string;
  referrerReward: number;
  referredReward: number;
  status: 'pending' | 'credited' | 'expired';
  createdAt: Date;
  creditedAt?: Date;
}
