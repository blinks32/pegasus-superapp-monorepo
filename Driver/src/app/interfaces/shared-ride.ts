/**
 * Interfaces for Ride Sharing functionality
 * Supports multiple passengers on the same route with shared pricing
 */

export interface Waypoint {
  lat: number;
  lng: number;
  address: string;
  type: 'pickup' | 'dropoff';
  riderId: string;
  riderName: string;
  order: number; // Sequence in the optimized route
  completed: boolean;
  completedAt?: any;
}

export interface SharedPassenger {
  riderId: string;
  riderName: string;
  riderPhone: string;
  riderImgUrl: string;
  riderRating: number;
  pickup: {
    lat: number;
    lng: number;
    address: string;
  };
  dropoff: {
    lat: number;
    lng: number;
    address: string;
  };
  status: 'waiting' | 'confirmed' | 'picked_up' | 'dropped_off' | 'cancelled';
  originalPrice: number;      // Price if riding solo
  discountedPrice: number;    // Price with sharing discount
  discountPercent: number;    // e.g., 25-40% off solo price
  joinedAt: any;              // Timestamp when passenger joined
  pickedUpAt?: any;
  droppedOffAt?: any;
  requestId: string;          // Original request ID for this passenger
}

export interface SharedRideRoute {
  waypoints: Waypoint[];              // Optimized pickup/dropoff order
  totalDistance: number;              // Total distance in km
  totalDuration: number;              // Total duration in minutes
  estimatedSavings: number;           // Total savings for all passengers
  polylinePath?: { lat: number; lng: number }[];
}

export interface SharedRide {
  sharedRideId: string;
  driverId: string;
  driverName: string;
  status: 'matching' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  passengers: SharedPassenger[];
  currentPassengerCount: number;
  maxPassengers: number;              // e.g., 3-4
  route: SharedRideRoute;
  vehicleCapacity: number;
  carType: string;
  createdAt: any;
  startedAt?: any;
  completedAt?: any;
  currentWaypointIndex: number;       // Track progress through waypoints
  totalFareCollected: number;
  driverEarnings: number;
  platformFee: number;
}

export interface RideMatchCandidate {
  requestId: string;
  riderId: string;
  riderName: string;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  originalPrice: number;
  routeSimilarity: number;            // 0-100% match with existing route
  detourDistance: number;             // Additional km if added
  detourDuration: number;             // Additional minutes if added
  potentialDiscount: number;          // Discount this rider would get
  expiresAt: any;                     // Match expires after timeout
}

export interface RideSharingPreferences {
  enabled: boolean;
  maxPassengers: number;              // 2-4 typically
  maxDetourPercent: number;           // Max detour allowed (e.g., 20%)
  preferredRouteTypes: string[];      // e.g., ['airport', 'downtown', 'suburban']
  minFareForSharing: number;          // Minimum fare to consider sharing
}

// Constants for ride sharing calculations
export const RIDE_SHARING_CONFIG = {
  BASE_DISCOUNT_PERCENT: 15,          // 15% discount per additional rider
  MAX_DISCOUNT_PERCENT: 40,           // Maximum 40% discount
  DRIVER_SHARE_PERCENT: 80,           // Driver keeps 80%
  PLATFORM_FEE_PERCENT: 20,           // Platform takes 20%
  MAX_DETOUR_PERCENT: 25,             // Max 25% extra distance for detour
  MATCH_TIMEOUT_MINUTES: 5,           // Match candidates expire after 5 min
  MIN_ROUTE_SIMILARITY: 60,           // Minimum 60% route overlap to match
  MAX_PASSENGERS_DEFAULT: 3,          // Default max passengers
};
