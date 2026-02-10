// Scheduled Ride Interfaces

export interface ScheduledRide {
  scheduleId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  riderEmail: string;
  
  // Location details
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  
  // Schedule details
  scheduledTime: Date;
  scheduledDate: string; // YYYY-MM-DD format for easy querying
  reminderSent: boolean;
  reminderTime?: Date;
  
  // Ride preferences
  carType: string;
  estimatedPrice: number;
  estimatedDistance: number;
  estimatedDuration: string;
  paymentMethod: 'cash' | 'card' | 'wallet';
  paymentMethodId?: string;
  
  // Multi-stop support
  stops?: RideStop[];
  
  // Status
  status: 'scheduled' | 'reminder_sent' | 'searching' | 'confirmed' | 'completed' | 'cancelled' | 'expired';
  
  // Driver assignment (when confirmed)
  driverId?: string;
  driverName?: string;
  requestId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface RideStop {
  stopId: string;
  order: number;
  lat: number;
  lng: number;
  address: string;
  estimatedArrival?: Date;
  actualArrival?: Date;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  waitTime?: number; // minutes to wait at stop
  notes?: string;
}

export interface ScheduleReminder {
  reminderId: string;
  scheduleId: string;
  riderId: string;
  reminderType: '24h' | '1h' | '30min' | '15min';
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
}
