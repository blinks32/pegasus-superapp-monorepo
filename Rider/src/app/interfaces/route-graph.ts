/**
 * Route Graph Interfaces for Dijkstra-based shared ride matching
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  neighbors: Edge[];
}

export interface Edge {
  targetId: string;
  weight: number;      // Travel time in seconds
  distance: number;    // Distance in meters
}

export interface PathResult {
  nodes: string[];
  coordinates: LatLng[];
  totalWeight: number;       // Total travel time in seconds
  totalDistance: number;     // Total distance in meters
  encodedPolyline?: string;  // Google encoded polyline
}

export interface RideCandidate {
  requestId: string;
  riderId: string;
  origin: LatLng;
  destination: LatLng;
  path?: PathResult;
  riderName?: string;
  riderToken?: string;       // OneSignal player ID for notifications
  createdAt?: Date;
  price?: number;
}

export interface ScoredMatch {
  candidate: RideCandidate;
  overlapScore: number;      // 0-1, higher = more route overlap
  detourCost: number;        // Additional time in seconds
  detourPercent: number;     // Detour as percentage of original route
  potentialSavings: number;  // Estimated fare savings percentage
}

export interface NearbyRiderAlert {
  riderId: string;
  riderToken: string;        // OneSignal player ID
  distance: number;          // Distance from new rider in meters
  overlapScore: number;
  message: string;
}

export interface SharedRideOpportunity {
  opportunityId: string;
  initiatorId: string;
  initiatorName: string;
  originGeohash: string;        // For GeoFire queries
  destinationGeohash: string;
  origin: LatLng;
  destination: LatLng;
  originAddress: string;
  destinationAddress: string;
  pathEncoded?: string;         // Encoded polyline for route
  estimatedPrice: number;
  potentialDiscount: number;    // 10-40% based on passengers
  status: 'open' | 'matched' | 'expired' | 'cancelled';
  expiresAt: Date;
  createdAt: Date;
  matchedRiders: string[];      // Rider IDs who accepted
  maxPassengers: number;
}

// Min-heap node for Dijkstra priority queue
export interface HeapNode {
  nodeId: string;
  distance: number;
}
