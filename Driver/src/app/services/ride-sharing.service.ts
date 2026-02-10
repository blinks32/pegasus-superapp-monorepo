import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  orderBy,
  limit,
  Unsubscribe
} from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import {
  SharedRide,
  SharedPassenger,
  Waypoint,
  SharedRideRoute,
  RideMatchCandidate,
  RideSharingPreferences,
  RIDE_SHARING_CONFIG
} from '../interfaces/shared-ride';
import { Rider } from '../interfaces/rider';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RideSharingService {
  private currentSharedRide$ = new BehaviorSubject<SharedRide | null>(null);
  private matchCandidates$ = new BehaviorSubject<RideMatchCandidate[]>([]);
  private sharedRideListener: Unsubscribe | null = null;

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  /**
   * Get the current shared ride as an observable
   */
  getCurrentSharedRide(): Observable<SharedRide | null> {
    return this.currentSharedRide$.asObservable();
  }

  /**
   * Get match candidates as an observable
   */
  getMatchCandidates(): Observable<RideMatchCandidate[]> {
    return this.matchCandidates$.asObservable();
  }

  /**
   * Calculate fare discount based on number of passengers
   */
  calculateDiscount(numPassengers: number): number {
    const discountPerPassenger = RIDE_SHARING_CONFIG.BASE_DISCOUNT_PERCENT;
    const maxDiscount = RIDE_SHARING_CONFIG.MAX_DISCOUNT_PERCENT;
    const discount = Math.min(discountPerPassenger * (numPassengers - 1), maxDiscount);
    return discount;
  }

  /**
   * Calculate individual fare for a shared ride passenger
   */
  calculateSharedFare(baseFare: number, numPassengers: number): number {
    const discount = this.calculateDiscount(numPassengers);
    return baseFare * (1 - discount / 100);
  }

  /**
   * Calculate driver earnings and platform fee from a shared ride
   */
  calculateEarningsBreakdown(totalFare: number): { driverEarnings: number; platformFee: number } {
    const driverShare = RIDE_SHARING_CONFIG.DRIVER_SHARE_PERCENT / 100;
    const driverEarnings = totalFare * driverShare;
    const platformFee = totalFare - driverEarnings;
    return { driverEarnings, platformFee };
  }

  /**
   * Calculate route similarity between two routes
   * Returns a percentage (0-100) indicating how similar the routes are
   */
  calculateRouteSimilarity(
    route1: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number } },
    route2: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number } }
  ): number {
    // Calculate direction vectors for both routes
    const dir1 = {
      lat: route1.dropoff.lat - route1.pickup.lat,
      lng: route1.dropoff.lng - route1.pickup.lng
    };
    const dir2 = {
      lat: route2.dropoff.lat - route2.pickup.lat,
      lng: route2.dropoff.lng - route2.pickup.lng
    };

    // Calculate dot product and magnitudes
    const dotProduct = dir1.lat * dir2.lat + dir1.lng * dir2.lng;
    const mag1 = Math.sqrt(dir1.lat ** 2 + dir1.lng ** 2);
    const mag2 = Math.sqrt(dir2.lat ** 2 + dir2.lng ** 2);

    if (mag1 === 0 || mag2 === 0) return 0;

    // Cosine similarity gives us direction similarity
    const cosineSimilarity = dotProduct / (mag1 * mag2);
    const directionScore = (cosineSimilarity + 1) / 2 * 100; // Normalize to 0-100

    // Calculate proximity score (how close are the pickup/dropoff points)
    const pickupDistance = this.calculateDistance(
      route1.pickup.lat, route1.pickup.lng,
      route2.pickup.lat, route2.pickup.lng
    );
    const dropoffDistance = this.calculateDistance(
      route1.dropoff.lat, route1.dropoff.lng,
      route2.dropoff.lat, route2.dropoff.lng
    );

    // Consider routes within 3km pickup and 5km dropoff as potentially shareable
    const maxPickupDistance = 3; // km
    const maxDropoffDistance = 5; // km
    
    const pickupScore = Math.max(0, (1 - pickupDistance / maxPickupDistance)) * 100;
    const dropoffScore = Math.max(0, (1 - dropoffDistance / maxDropoffDistance)) * 100;

    // Weighted average: direction matters most, then dropoff, then pickup
    const similarity = (directionScore * 0.4 + dropoffScore * 0.35 + pickupScore * 0.25);
    
    return Math.round(similarity);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate estimated detour for adding a new passenger
   */
  calculateDetour(
    currentRoute: SharedRideRoute,
    newPassenger: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number } }
  ): { detourDistance: number; detourDuration: number; isAcceptable: boolean } {
    // Simplified detour calculation
    // In production, you'd use Google Maps Directions API for accurate results
    
    const currentDistance = currentRoute.totalDistance;
    
    // Estimate additional distance for pickup detour
    let minPickupDetour = Infinity;
    for (let i = 0; i < currentRoute.waypoints.length; i++) {
      const wp = currentRoute.waypoints[i];
      const detour = this.calculateDistance(wp.lat, wp.lng, newPassenger.pickup.lat, newPassenger.pickup.lng);
      if (detour < minPickupDetour) {
        minPickupDetour = detour;
      }
    }
    
    // Estimate additional distance for dropoff
    let minDropoffDetour = Infinity;
    for (let i = 0; i < currentRoute.waypoints.length; i++) {
      const wp = currentRoute.waypoints[i];
      const detour = this.calculateDistance(wp.lat, wp.lng, newPassenger.dropoff.lat, newPassenger.dropoff.lng);
      if (detour < minDropoffDetour) {
        minDropoffDetour = detour;
      }
    }
    
    const totalDetour = minPickupDetour + minDropoffDetour;
    const detourPercent = currentDistance > 0 ? (totalDetour / currentDistance) * 100 : 0;
    
    // Be more lenient: accept if detour is within threshold OR if absolute detour is small (< 2km)
    const isAcceptable = detourPercent <= RIDE_SHARING_CONFIG.MAX_DETOUR_PERCENT || totalDetour < 2;
    
    // Estimate time (assuming average speed of 30 km/h in city)
    const detourDuration = (totalDetour / 30) * 60; // minutes
    
    return {
      detourDistance: Math.round(totalDetour * 100) / 100,
      detourDuration: Math.round(detourDuration),
      isAcceptable
    };
  }

  /**
   * Optimize waypoint order for minimum total distance (simple greedy algorithm)
   */
  optimizeWaypointOrder(waypoints: Waypoint[], startLat: number, startLng: number): Waypoint[] {
    const optimized: Waypoint[] = [];
    const remaining = [...waypoints];
    let currentLat = startLat;
    let currentLng = startLng;
    
    // Track which riders have been picked up
    const pickedUp = new Set<string>();
    
    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const wp = remaining[i];
        
        // Can only do dropoff if rider has been picked up
        if (wp.type === 'dropoff' && !pickedUp.has(wp.riderId)) {
          continue;
        }
        
        const distance = this.calculateDistance(currentLat, currentLng, wp.lat, wp.lng);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIdx = i;
        }
      }
      
      if (bestIdx === -1) break;
      
      const nextWp = remaining.splice(bestIdx, 1)[0];
      nextWp.order = optimized.length;
      optimized.push(nextWp);
      
      currentLat = nextWp.lat;
      currentLng = nextWp.lng;
      
      if (nextWp.type === 'pickup') {
        pickedUp.add(nextWp.riderId);
      }
    }
    
    return optimized;
  }

  /**
   * Create a new shared ride from an existing ride request
   */
  async createSharedRide(
    driverId: string,
    driverName: string,
    firstPassenger: Rider,
    carType: string,
    vehicleCapacity: number = 4,
    maxPassengers: number = RIDE_SHARING_CONFIG.MAX_PASSENGERS_DEFAULT
  ): Promise<SharedRide> {
    const sharedRideId = uuidv4();
    
    const passenger: SharedPassenger = {
      riderId: firstPassenger.Rider_id,
      riderName: firstPassenger.Rider_name,
      riderPhone: String(firstPassenger.Rider_phone),
      riderImgUrl: firstPassenger.Rider_imgUrl,
      riderRating: firstPassenger.Rider_rating,
      pickup: {
        lat: firstPassenger.Loc_lat,
        lng: firstPassenger.Loc_lng,
        address: firstPassenger.Rider_Location
      },
      dropoff: {
        lat: firstPassenger.Des_lat,
        lng: firstPassenger.Des_lng,
        address: firstPassenger.Rider_Destination
      },
      status: 'confirmed',
      originalPrice: firstPassenger.price,
      discountedPrice: firstPassenger.price, // No discount for first passenger
      discountPercent: 0,
      joinedAt: new Date().toISOString(),
      requestId: firstPassenger.requestId || ''
    };
    
    const waypoints: Waypoint[] = [
      {
        lat: firstPassenger.Loc_lat,
        lng: firstPassenger.Loc_lng,
        address: firstPassenger.Rider_Location,
        type: 'pickup',
        riderId: firstPassenger.Rider_id,
        riderName: firstPassenger.Rider_name,
        order: 0,
        completed: false
      },
      {
        lat: firstPassenger.Des_lat,
        lng: firstPassenger.Des_lng,
        address: firstPassenger.Rider_Destination,
        type: 'dropoff',
        riderId: firstPassenger.Rider_id,
        riderName: firstPassenger.Rider_name,
        order: 1,
        completed: false
      }
    ];
    
    const route: SharedRideRoute = {
      waypoints,
      totalDistance: this.calculateDistance(
        firstPassenger.Loc_lat, firstPassenger.Loc_lng,
        firstPassenger.Des_lat, firstPassenger.Des_lng
      ),
      totalDuration: 0, // Will be updated with actual directions
      estimatedSavings: 0
    };
    
    const sharedRide: SharedRide = {
      sharedRideId,
      driverId,
      driverName,
      status: 'matching',
      passengers: [passenger],
      currentPassengerCount: 1,
      maxPassengers,
      route,
      vehicleCapacity,
      carType,
      createdAt: serverTimestamp(),
      currentWaypointIndex: 0,
      totalFareCollected: firstPassenger.price,
      driverEarnings: 0,
      platformFee: 0
    };
    
    // Save to Firestore
    await setDoc(doc(this.firestore, 'SharedRides', sharedRideId), sharedRide);
    
    // Update driver's current shared ride
    await updateDoc(doc(this.firestore, 'Drivers', driverId), {
      currentSharedRideId: sharedRideId
    });
    
    this.currentSharedRide$.next(sharedRide);
    return sharedRide;
  }

  /**
   * Add a passenger to an existing shared ride
   */
  async addPassengerToSharedRide(
    sharedRideId: string,
    newPassenger: Rider,
    driverLat: number,
    driverLng: number
  ): Promise<SharedRide | null> {
    const sharedRideRef = doc(this.firestore, 'SharedRides', sharedRideId);
    const sharedRideDoc = await getDoc(sharedRideRef);
    
    if (!sharedRideDoc.exists()) {
      console.error('Shared ride not found');
      return null;
    }
    
    const sharedRide = sharedRideDoc.data() as SharedRide;
    
    // Check if we can add more passengers
    if (sharedRide.currentPassengerCount >= sharedRide.maxPassengers) {
      console.error('Shared ride is full');
      return null;
    }
    
    // Calculate discount for all passengers
    const newPassengerCount = sharedRide.currentPassengerCount + 1;
    const discount = this.calculateDiscount(newPassengerCount);
    
    // Create new passenger entry
    const passenger: SharedPassenger = {
      riderId: newPassenger.Rider_id,
      riderName: newPassenger.Rider_name,
      riderPhone: String(newPassenger.Rider_phone),
      riderImgUrl: newPassenger.Rider_imgUrl,
      riderRating: newPassenger.Rider_rating,
      pickup: {
        lat: newPassenger.Loc_lat,
        lng: newPassenger.Loc_lng,
        address: newPassenger.Rider_Location
      },
      dropoff: {
        lat: newPassenger.Des_lat,
        lng: newPassenger.Des_lng,
        address: newPassenger.Rider_Destination
      },
      status: 'confirmed',
      originalPrice: newPassenger.price,
      discountedPrice: this.calculateSharedFare(newPassenger.price, newPassengerCount),
      discountPercent: discount,
      joinedAt: new Date().toISOString(),
      requestId: newPassenger.requestId || ''
    };
    
    // Update existing passengers' discounts
    const updatedPassengers = sharedRide.passengers.map(p => ({
      ...p,
      discountedPrice: this.calculateSharedFare(p.originalPrice, newPassengerCount),
      discountPercent: discount
    }));
    updatedPassengers.push(passenger);
    
    // Add new waypoints
    const newWaypoints: Waypoint[] = [
      ...sharedRide.route.waypoints,
      {
        lat: newPassenger.Loc_lat,
        lng: newPassenger.Loc_lng,
        address: newPassenger.Rider_Location,
        type: 'pickup',
        riderId: newPassenger.Rider_id,
        riderName: newPassenger.Rider_name,
        order: 0,
        completed: false
      },
      {
        lat: newPassenger.Des_lat,
        lng: newPassenger.Des_lng,
        address: newPassenger.Rider_Destination,
        type: 'dropoff',
        riderId: newPassenger.Rider_id,
        riderName: newPassenger.Rider_name,
        order: 0,
        completed: false
      }
    ];
    
    // Optimize waypoint order
    const optimizedWaypoints = this.optimizeWaypointOrder(newWaypoints, driverLat, driverLng);
    
    // Calculate new totals
    const totalFare = updatedPassengers.reduce((sum, p) => sum + p.discountedPrice, 0);
    const estimatedSavings = updatedPassengers.reduce((sum, p) => sum + (p.originalPrice - p.discountedPrice), 0);
    const { driverEarnings, platformFee } = this.calculateEarningsBreakdown(totalFare);
    
    // Update Firestore
    await updateDoc(sharedRideRef, {
      passengers: updatedPassengers,
      currentPassengerCount: newPassengerCount,
      'route.waypoints': optimizedWaypoints,
      'route.estimatedSavings': estimatedSavings,
      totalFareCollected: totalFare,
      driverEarnings,
      platformFee
    });
    
    // Return updated shared ride
    const updatedSharedRide: SharedRide = {
      ...sharedRide,
      passengers: updatedPassengers,
      currentPassengerCount: newPassengerCount,
      route: {
        ...sharedRide.route,
        waypoints: optimizedWaypoints,
        estimatedSavings
      },
      totalFareCollected: totalFare,
      driverEarnings,
      platformFee
    };
    
    this.currentSharedRide$.next(updatedSharedRide);
    return updatedSharedRide;
  }

  /**
   * Mark a waypoint as completed (pickup or dropoff)
   * Returns the completed waypoint info including the passenger's requestId
   */
  async completeWaypoint(sharedRideId: string, waypointIndex: number): Promise<{ riderId: string; requestId: string; type: 'pickup' | 'dropoff' } | null> {
    const sharedRideRef = doc(this.firestore, 'SharedRides', sharedRideId);
    const sharedRideDoc = await getDoc(sharedRideRef);
    
    if (!sharedRideDoc.exists()) return null;
    
    const sharedRide = sharedRideDoc.data() as SharedRide;
    const waypoints = [...sharedRide.route.waypoints];
    const completedWaypoint = waypoints[waypointIndex];
    
    const now = new Date().toISOString();
    
    waypoints[waypointIndex] = {
      ...completedWaypoint,
      completed: true,
      completedAt: now
    };
    
    // Find the passenger to get their requestId
    const passenger = sharedRide.passengers.find(p => p.riderId === completedWaypoint.riderId);
    const requestId = passenger?.requestId || '';
    
    // Update passenger status based on waypoint type
    const passengers = sharedRide.passengers.map(p => {
      if (p.riderId === completedWaypoint.riderId) {
        if (completedWaypoint.type === 'pickup') {
          return { ...p, status: 'picked_up' as const, pickedUpAt: now };
        } else if (completedWaypoint.type === 'dropoff') {
          return { ...p, status: 'dropped_off' as const, droppedOffAt: now };
        }
      }
      return p;
    });
    
    // Check if all waypoints are completed
    const allCompleted = waypoints.every(wp => wp.completed);
    const newStatus = allCompleted ? 'completed' : sharedRide.status;
    
    await updateDoc(sharedRideRef, {
      'route.waypoints': waypoints,
      passengers,
      currentWaypointIndex: waypointIndex + 1,
      status: newStatus,
      ...(allCompleted ? { completedAt: serverTimestamp() } : {})
    });
    
    // Return info about the completed waypoint for updating the Request document
    return {
      riderId: completedWaypoint.riderId,
      requestId,
      type: completedWaypoint.type as 'pickup' | 'dropoff'
    };
  }

  /**
   * Start the shared ride
   */
  async startSharedRide(sharedRideId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'SharedRides', sharedRideId), {
      status: 'in_progress',
      startedAt: serverTimestamp()
    });
  }

  /**
   * Cancel a passenger from a shared ride
   */
  async cancelPassengerFromSharedRide(
    sharedRideId: string,
    riderId: string,
    reason: string
  ): Promise<void> {
    const sharedRideRef = doc(this.firestore, 'SharedRides', sharedRideId);
    const sharedRideDoc = await getDoc(sharedRideRef);
    
    if (!sharedRideDoc.exists()) return;
    
    const sharedRide = sharedRideDoc.data() as SharedRide;
    
    // Update passenger status
    const passengers = sharedRide.passengers.map(p => {
      if (p.riderId === riderId) {
        return { ...p, status: 'cancelled' as const };
      }
      return p;
    });
    
    // Remove waypoints for cancelled passenger
    const waypoints = sharedRide.route.waypoints.filter(wp => wp.riderId !== riderId);
    
    const newPassengerCount = sharedRide.currentPassengerCount - 1;
    
    // Recalculate fares
    const discount = this.calculateDiscount(newPassengerCount);
    const updatedPassengers = passengers.map(p => {
      if (p.status !== 'cancelled') {
        return {
          ...p,
          discountedPrice: newPassengerCount > 1 
            ? this.calculateSharedFare(p.originalPrice, newPassengerCount)
            : p.originalPrice,
          discountPercent: newPassengerCount > 1 ? discount : 0
        };
      }
      return p;
    });
    
    const activePassengers = updatedPassengers.filter(p => p.status !== 'cancelled');
    const totalFare = activePassengers.reduce((sum, p) => sum + p.discountedPrice, 0);
    const { driverEarnings, platformFee } = this.calculateEarningsBreakdown(totalFare);
    
    // If no passengers left, cancel the whole ride
    if (activePassengers.length === 0) {
      await updateDoc(sharedRideRef, {
        status: 'cancelled',
        passengers: updatedPassengers
      });
      return;
    }
    
    await updateDoc(sharedRideRef, {
      passengers: updatedPassengers,
      currentPassengerCount: activePassengers.length,
      'route.waypoints': waypoints,
      totalFareCollected: totalFare,
      driverEarnings,
      platformFee
    });
  }

  /**
   * Find potential matches for a new ride request
   */
  async findMatchCandidates(
    driverId: string,
    driverLat: number,
    driverLng: number
  ): Promise<RideMatchCandidate[]> {
    console.log('Finding match candidates for driver:', driverId);
    
    // Get driver's current shared ride
    const driverDoc = await getDoc(doc(this.firestore, 'Drivers', driverId));
    const driverData = driverDoc.data();
    
    if (!driverData?.currentSharedRideId) {
      console.log('No current shared ride ID found');
      return [];
    }
    
    const sharedRideDoc = await getDoc(doc(this.firestore, 'SharedRides', driverData.currentSharedRideId));
    if (!sharedRideDoc.exists()) {
      console.log('Shared ride document not found');
      return [];
    }
    
    const sharedRide = sharedRideDoc.data() as SharedRide;
    console.log('Current shared ride status:', sharedRide.status, 'Passengers:', sharedRide.currentPassengerCount);
    
    // Can't add more if full
    if (sharedRide.currentPassengerCount >= sharedRide.maxPassengers) {
      console.log('Shared ride is full');
      return [];
    }
    
    // Get IDs of riders already in the shared ride to exclude them
    const existingRiderIds = sharedRide.passengers.map(p => p.riderId);
    
    // Query ALL pending requests (not just those with sharedRideAccepted)
    // This allows matching with any pending ride request
    const requestsRef = collection(this.firestore, 'Request');
    const pendingRequestsQuery = query(
      requestsRef,
      where('status', '==', 'pending'),
      limit(50)
    );
    
    const requestsSnapshot = await getDocs(pendingRequestsQuery);
    console.log('Found pending requests:', requestsSnapshot.size);
    
    const candidates: RideMatchCandidate[] = [];
    
    const currentRoute = {
      pickup: sharedRide.passengers[0].pickup,
      dropoff: sharedRide.passengers[0].dropoff
    };
    
    for (const requestDoc of requestsSnapshot.docs) {
      const request = requestDoc.data() as Rider;
      const requestData = requestDoc.data() as any; // For checking additional fields
      
      // Skip if this rider is already in the shared ride
      if (existingRiderIds.includes(request.Rider_id)) {
        continue;
      }
      
      // Skip if this request already has a driver assigned
      if (requestData.driverId || requestData.Driver_id) {
        continue;
      }
      
      const candidateRoute = {
        pickup: { lat: request.Loc_lat, lng: request.Loc_lng },
        dropoff: { lat: request.Des_lat, lng: request.Des_lng }
      };
      
      // Calculate distance from driver to candidate's pickup
      const pickupDistance = this.calculateDistance(
        driverLat, driverLng,
        request.Loc_lat, request.Loc_lng
      );
      
      // Skip if pickup is too far (more than 10km from current location for testing)
      if (pickupDistance > 10) {
        console.log(`Skipping ${request.Rider_name}: pickup too far (${pickupDistance.toFixed(1)}km)`);
        continue;
      }
      
      const similarity = this.calculateRouteSimilarity(currentRoute, candidateRoute);
      console.log(`Route similarity for ${request.Rider_name}:`, similarity, 'Pickup distance:', pickupDistance.toFixed(1), 'km');
      
      // Very lenient for testing - accept if pickup is within 10km
      // In production, use stricter thresholds
      const minSimilarity = pickupDistance < 2 ? 10 : (pickupDistance < 5 ? 20 : 30);
      console.log(`Min similarity threshold for ${request.Rider_name}:`, minSimilarity);
      
      if (similarity >= minSimilarity) {
        const detour = this.calculateDetour(sharedRide.route, candidateRoute);
        console.log(`Detour for ${request.Rider_name}:`, detour);
        
        // For testing, always accept (detour check can be enabled in production)
        const acceptDetour = true; // detour.isAcceptable;
        
        if (acceptDetour) {
          const newPassengerCount = sharedRide.currentPassengerCount + 1;
          const discount = this.calculateDiscount(newPassengerCount);
          
          candidates.push({
            requestId: requestDoc.id,
            riderId: request.Rider_id,
            riderName: request.Rider_name,
            pickup: { ...candidateRoute.pickup, address: request.Rider_Location },
            dropoff: { ...candidateRoute.dropoff, address: request.Rider_Destination },
            originalPrice: request.price,
            routeSimilarity: similarity,
            detourDistance: detour.detourDistance,
            detourDuration: detour.detourDuration,
            potentialDiscount: discount,
            expiresAt: new Date(Date.now() + RIDE_SHARING_CONFIG.MATCH_TIMEOUT_MINUTES * 60000)
          });
          console.log(`Added candidate: ${request.Rider_name}`);
        }
      }
    }
    
    // Sort by route similarity
    candidates.sort((a, b) => b.routeSimilarity - a.routeSimilarity);
    
    this.matchCandidates$.next(candidates);
    return candidates;
  }

  /**
   * Listen to shared ride updates
   */
  subscribeToSharedRide(sharedRideId: string): void {
    if (this.sharedRideListener) {
      this.sharedRideListener();
    }
    
    this.sharedRideListener = onSnapshot(
      doc(this.firestore, 'SharedRides', sharedRideId),
      (snapshot) => {
        if (snapshot.exists()) {
          this.currentSharedRide$.next(snapshot.data() as SharedRide);
        } else {
          this.currentSharedRide$.next(null);
        }
      }
    );
  }

  /**
   * Stop listening to shared ride updates
   */
  unsubscribeFromSharedRide(): void {
    if (this.sharedRideListener) {
      this.sharedRideListener();
      this.sharedRideListener = null;
    }
    this.currentSharedRide$.next(null);
  }

  /**
   * Update driver's ride sharing preferences
   */
  async updateRideSharingPreferences(
    driverId: string,
    preferences: RideSharingPreferences
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'Drivers', driverId), {
      rideSharingEnabled: preferences.enabled,
      rideSharingPreferences: preferences
    });
  }

  /**
   * Get the next waypoint to navigate to
   */
  getNextWaypoint(sharedRide: SharedRide): Waypoint | null {
    const incompleteWaypoints = sharedRide.route.waypoints.filter(wp => !wp.completed);
    return incompleteWaypoints.length > 0 ? incompleteWaypoints[0] : null;
  }

  /**
   * Get passengers currently in the vehicle
   */
  getPassengersInVehicle(sharedRide: SharedRide): SharedPassenger[] {
    return sharedRide.passengers.filter(p => p.status === 'picked_up');
  }

  /**
   * Get passengers waiting to be picked up
   */
  getPassengersWaiting(sharedRide: SharedRide): SharedPassenger[] {
    return sharedRide.passengers.filter(p => p.status === 'confirmed' || p.status === 'waiting');
  }
}
