// Safety Features Interfaces

export interface EmergencyContact {
  contactId: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface TripShare {
  shareId: string;
  tripId: string;
  riderId: string;
  riderName: string;
  sharedWith: SharedContact[];
  shareLink: string;
  shareCode: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  
  // Real-time trip data
  currentLat?: number;
  currentLng?: number;
  pickupAddress: string;
  destinationAddress: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  driverCar?: string;
  estimatedArrival?: Date;
  tripStatus: 'waiting' | 'picked_up' | 'in_transit' | 'completed' | 'cancelled';
}

export interface SharedContact {
  contactId: string;
  name: string;
  phone?: string;
  email?: string;
  notificationSent: boolean;
  viewedAt?: Date;
}

export interface SOSAlert {
  alertId: string;
  tripId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  
  // Location at time of alert
  lat: number;
  lng: number;
  address?: string;
  
  // Alert details
  alertType: 'sos' | 'safety_check' | 'route_deviation' | 'long_stop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  
  // Response
  status: 'active' | 'acknowledged' | 'resolved' | 'false_alarm';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolution?: string;
  
  // Notifications
  emergencyContactsNotified: boolean;
  adminNotified: boolean;
  
  // Audio recording
  audioRecordingUrl?: string;
  audioRecordingDuration?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverVerification {
  verificationId: string;
  driverId: string;
  verificationType: 'identity' | 'background_check' | 'vehicle' | 'license' | 'insurance';
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  verifiedAt?: Date;
  expiresAt?: Date;
  documentUrl?: string;
  notes?: string;
  verifiedBy?: string;
}

export interface SafetyRating {
  ratingId: string;
  tripId: string;
  riderId: string;
  driverId: string;
  overallRating: number; // 1-5
  safetyRating: number; // 1-5
  drivingRating: number; // 1-5
  vehicleConditionRating: number; // 1-5
  comments?: string;
  reportedIssues?: SafetyIssue[];
  createdAt: Date;
}

export interface SafetyIssue {
  issueType: 'speeding' | 'reckless_driving' | 'phone_use' | 'intoxication' | 'harassment' | 'vehicle_condition' | 'route_deviation' | 'other';
  description?: string;
  severity: 'minor' | 'moderate' | 'severe';
}

export interface AudioRecording {
  recordingId: string;
  tripId: string;
  riderId: string;
  driverId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  fileUrl?: string;
  fileSize?: number; // bytes
  status: 'recording' | 'completed' | 'failed' | 'deleted';
  consentGiven: boolean;
  autoDeleteAt: Date; // Auto-delete after X days
}
