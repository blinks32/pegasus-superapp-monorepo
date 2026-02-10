// Subscription Plans Interfaces

export interface SubscriptionPlan {
  planId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  
  // Benefits
  discountPercent: number; // Discount on all rides
  freeRides: number; // Number of free rides per cycle
  priorityPickup: boolean;
  noSurgeCharges: boolean;
  maxSurgeDiscount?: number; // Max surge discount percentage
  
  // Limits
  maxRidesPerMonth?: number;
  maxDistancePerRide?: number;
  validCarTypes: string[]; // Which car types are included
  
  // Status
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSubscription {
  subscriptionId: string;
  userId: string;
  planId: string;
  planName: string;
  
  // Billing
  price: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: Date;
  lastBillingDate?: Date;
  
  // Usage tracking
  ridesUsedThisCycle: number;
  freeRidesRemaining: number;
  totalSavings: number;
  
  // Status
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'payment_failed';
  startDate: Date;
  endDate?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  
  // Payment
  paymentMethodId?: string;
  stripeSubscriptionId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  usageId: string;
  subscriptionId: string;
  userId: string;
  rideId: string;
  
  originalPrice: number;
  discountApplied: number;
  finalPrice: number;
  wasFreeRide: boolean;
  
  createdAt: Date;
}
