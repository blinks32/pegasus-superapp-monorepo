// Fare Splitting Interfaces

export interface FareSplit {
  splitId: string;
  rideId: string;
  requesterId: string;
  requesterName: string;
  totalAmount: number;
  currency: string;
  
  // Split participants
  participants: SplitParticipant[];
  splitType: 'equal' | 'custom' | 'percentage';
  
  // Status
  status: 'pending' | 'partial' | 'completed' | 'cancelled' | 'expired';
  expiresAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface SplitParticipant {
  participantId: string;
  userId?: string; // If registered user
  name: string;
  phone?: string;
  email?: string;
  
  // Amount
  amount: number;
  percentage?: number;
  
  // Payment
  paymentStatus: 'pending' | 'paid' | 'declined' | 'refunded';
  paymentMethod?: 'card' | 'wallet' | 'cash';
  paymentMethodId?: string;
  paidAt?: Date;
  
  // Invitation
  inviteSent: boolean;
  inviteAccepted: boolean;
  inviteDeclined: boolean;
  inviteExpired: boolean;
}

export interface SplitInvitation {
  inviteId: string;
  splitId: string;
  rideId: string;
  
  // Inviter
  inviterId: string;
  inviterName: string;
  
  // Invitee
  inviteePhone?: string;
  inviteeEmail?: string;
  inviteeUserId?: string;
  
  // Details
  amount: number;
  currency: string;
  rideDetails: {
    pickup: string;
    destination: string;
    date: Date;
  };
  
  // Status
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: Date;
  
  createdAt: Date;
  respondedAt?: Date;
}

export interface SplitPaymentRequest {
  requestId: string;
  splitId: string;
  participantId: string;
  amount: number;
  currency: string;
  
  // Payment link for non-app users
  paymentLink?: string;
  paymentLinkExpiry?: Date;
  
  // Reminders
  remindersSent: number;
  lastReminderAt?: Date;
  
  status: 'pending' | 'completed' | 'failed' | 'expired';
  createdAt: Date;
}
