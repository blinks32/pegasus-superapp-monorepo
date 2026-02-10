// Package Delivery Interfaces

export interface PackageDelivery {
  deliveryId: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  
  // Pickup details
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  pickupInstructions?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  
  // Delivery details
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress: string;
  deliveryInstructions?: string;
  recipientName: string;
  recipientPhone: string;
  
  // Package details
  packageSize: 'small' | 'medium' | 'large' | 'extra_large';
  packageWeight?: number; // kg
  packageDescription?: string;
  packageValue?: number;
  isFragile: boolean;
  requiresSignature: boolean;
  
  // Photos
  pickupPhotoUrl?: string;
  deliveryPhotoUrl?: string;
  
  // Pricing
  estimatedPrice: number;
  finalPrice?: number;
  currency: string;
  insuranceAmount?: number;
  
  // Driver
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  
  // Tracking
  trackingCode: string;
  currentLat?: number;
  currentLng?: number;
  estimatedDeliveryTime?: Date;
  
  // Status
  status: 'pending' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  
  // Timestamps
  createdAt: Date;
  acceptedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  
  // Payment
  paymentMethod: 'cash' | 'card' | 'wallet';
  paymentMethodId?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paidBy: 'sender' | 'recipient';
}

export interface PackageSize {
  sizeId: string;
  name: string;
  description: string;
  maxWeight: number; // kg
  maxDimensions: {
    length: number;
    width: number;
    height: number;
  };
  basePrice: number;
  pricePerKm: number;
  currency: string;
  isActive: boolean;
}

export interface DeliveryTracking {
  trackingId: string;
  deliveryId: string;
  trackingCode: string;
  
  events: TrackingEvent[];
  
  // Current status
  currentStatus: string;
  currentLat?: number;
  currentLng?: number;
  
  // Sharing
  shareLink: string;
  isPublic: boolean;
}

export interface TrackingEvent {
  eventId: string;
  timestamp: Date;
  status: string;
  description: string;
  lat?: number;
  lng?: number;
  address?: string;
  photoUrl?: string;
}
