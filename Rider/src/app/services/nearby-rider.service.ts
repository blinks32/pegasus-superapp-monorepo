import { Injectable, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  Unsubscribe
} from '@angular/fire/firestore';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastController } from '@ionic/angular';

import { DijkstraService } from './dijkstra.service';
import { OnesignalService } from './one-signal.service';
import {
  LatLng,
  PathResult,
  RideCandidate,
  ScoredMatch,
  SharedRideOpportunity,
  NearbyRiderAlert
} from '../interfaces/route-graph';

@Injectable({
  providedIn: 'root'
})
export class NearbyRiderService {
  // Configuration
  private readonly SEARCH_RADIUS_KM = 5;           // Search within 5km
  private readonly MIN_OVERLAP_THRESHOLD = 0.35;   // 35% route overlap minimum
  private readonly MAX_RIDERS_TO_NOTIFY = 10;      // Max riders to notify
  private readonly OPPORTUNITY_EXPIRY_MINUTES = 5; // Opportunities expire after 5 min
  private readonly NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000; // 10 min cooldown per rider

  // Track notification history to prevent spam
  private notificationHistory: Map<string, number> = new Map();

  // Observable for nearby opportunities
  private nearbyOpportunitiesSubject = new BehaviorSubject<SharedRideOpportunity[]>([]);
  nearbyOpportunities$ = this.nearbyOpportunitiesSubject.asObservable();

  // Active subscription
  private opportunitySubscription: Unsubscribe | null = null;

  constructor(
    private firestore: Firestore,
    private dijkstraService: DijkstraService,
    private oneSignalService: OnesignalService,
    private toastController: ToastController,
    private ngZone: NgZone
  ) { }

  /**
   * Find active riders nearby who might want to share this ride
   * Uses GeoFire for efficient location-based queries
   */
  async findNearbyActiveRiders(
    newRiderLocation: LatLng,
    newRiderDestination: LatLng,
    excludeRiderId: string
  ): Promise<RideCandidate[]> {
    const candidates: RideCandidate[] = [];

    try {
      // Generate geohash bounds for the search area
      const center: [number, number] = [newRiderLocation.lat, newRiderLocation.lng];
      const radiusM = this.SEARCH_RADIUS_KM * 1000;
      const bounds = geohashQueryBounds(center, radiusM);

      // Query the Request collection for pending rides in the area
      const requestsRef = collection(this.firestore, 'Request');

      for (const b of bounds) {
        const q = query(
          requestsRef,
          where('status', '==', 'pending'),
          where('sharedRideAccepted', '==', true),
          where('originGeohash', '>=', b[0]),
          where('originGeohash', '<=', b[1]),
          limit(50)
        );

        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Exclude the current rider
          if (data['Rider_id'] === excludeRiderId) return;

          // Verify actual distance (geohash can have false positives)
          const riderLocation: [number, number] = [data['Loc_lat'], data['Loc_lng']];
          const distanceKm = distanceBetween(center, riderLocation);

          if (distanceKm <= this.SEARCH_RADIUS_KM) {
            candidates.push({
              requestId: doc.id,
              riderId: data['Rider_id'],
              origin: { lat: data['Loc_lat'], lng: data['Loc_lng'] },
              destination: { lat: data['Des_lat'], lng: data['Des_lng'] },
              riderName: data['Rider_name'],
              riderToken: data['oneSignalPlayerId'] || null,
              createdAt: data['createdAt']?.toDate(),
              price: data['price']
            });
          }
        });
      }

      console.log(`Found ${candidates.length} nearby active riders`);
      return candidates;
    } catch (error) {
      console.error('Error finding nearby riders:', error);
      return [];
    }
  }

  /**
   * Score nearby riders by route similarity using Dijkstra
   */
  async scoreNearbyRiders(
    newRiderPath: PathResult,
    nearbyCandidates: RideCandidate[]
  ): Promise<ScoredMatch[]> {
    return this.dijkstraService.findSimilarRoutes(
      newRiderPath,
      nearbyCandidates,
      0.25 // 25% max detour
    );
  }

  /**
   * Create a shared ride opportunity document
   */
  async createSharedRideOpportunity(
    initiatorId: string,
    initiatorName: string,
    origin: LatLng,
    destination: LatLng,
    originAddress: string,
    destinationAddress: string,
    estimatedPrice: number,
    path?: PathResult
  ): Promise<string> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.OPPORTUNITY_EXPIRY_MINUTES * 60 * 1000);

      const opportunity: Omit<SharedRideOpportunity, 'opportunityId'> = {
        initiatorId,
        initiatorName,
        originGeohash: geohashForLocation([origin.lat, origin.lng]),
        destinationGeohash: geohashForLocation([destination.lat, destination.lng]),
        origin,
        destination,
        originAddress,
        destinationAddress,
        pathEncoded: path?.encodedPolyline,
        estimatedPrice,
        potentialDiscount: 10, // Starting discount with 2 passengers
        status: 'open',
        expiresAt,
        createdAt: now,
        matchedRiders: [],
        maxPassengers: 4
      };

      const docRef = await addDoc(
        collection(this.firestore, 'SharedRideOpportunities'),
        {
          ...opportunity,
          expiresAt: Timestamp.fromDate(expiresAt),
          createdAt: Timestamp.fromDate(now)
        }
      );

      console.log('Created shared ride opportunity:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating shared ride opportunity:', error);
      throw error;
    }
  }

  /**
   * Send push notifications to nearby riders about shared ride opportunity
   */
  async notifyNearbyRiders(
    matches: ScoredMatch[],
    newRiderInfo: { name: string; originArea: string; destinationArea: string },
    opportunityId: string
  ): Promise<number> {
    let notificationsSent = 0;

    // Sort by overlap score and limit
    const topMatches = matches
      .filter(m => m.overlapScore >= this.MIN_OVERLAP_THRESHOLD)
      .slice(0, this.MAX_RIDERS_TO_NOTIFY);

    for (const match of topMatches) {
      // Check notification cooldown
      const lastNotified = this.notificationHistory.get(match.candidate.riderId);
      if (lastNotified && Date.now() - lastNotified < this.NOTIFICATION_COOLDOWN_MS) {
        console.log(`Skipping notification for ${match.candidate.riderId} - cooldown active`);
        continue;
      }

      // Skip if no push token
      if (!match.candidate.riderToken) {
        console.log(`No push token for rider ${match.candidate.riderId}`);
        continue;
      }

      try {
        const savingsPercent = match.potentialSavings;
        const title = '🚗 Shared Ride Opportunity!';
        const message = `${newRiderInfo.name} is heading your way! Save up to ${savingsPercent}% by sharing.`;

        // Send notification via OneSignal
        await this.oneSignalService.sendNotification(
          message,
          title,
          {
            type: 'shared_ride_opportunity',
            opportunityId,
            savings: savingsPercent,
            originArea: newRiderInfo.originArea,
            destinationArea: newRiderInfo.destinationArea,
            overlapScore: match.overlapScore
          },
          [match.candidate.riderToken]
        ).toPromise();

        // Update notification history
        this.notificationHistory.set(match.candidate.riderId, Date.now());
        notificationsSent++;

        console.log(`Notification sent to rider ${match.candidate.riderId}`);
      } catch (error) {
        console.error(`Failed to notify rider ${match.candidate.riderId}:`, error);
      }
    }

    console.log(`Sent ${notificationsSent} shared ride notifications`);
    return notificationsSent;
  }

  /**
   * Subscribe to nearby shared ride opportunities for a rider's location
   */
  subscribeToNearbyOpportunities(
    riderLocation: LatLng,
    riderId: string
  ): Observable<SharedRideOpportunity[]> {
    // Unsubscribe from previous listener
    this.unsubscribeFromOpportunities();

    const center: [number, number] = [riderLocation.lat, riderLocation.lng];
    const radiusM = this.SEARCH_RADIUS_KM * 1000;
    const bounds = geohashQueryBounds(center, radiusM);

    // We'll aggregate results from multiple queries
    const allOpportunities: Map<string, SharedRideOpportunity> = new Map();
    const unsubscribes: Unsubscribe[] = [];

    for (const b of bounds) {
      const q = query(
        collection(this.firestore, 'SharedRideOpportunities'),
        where('status', '==', 'open'),
        where('originGeohash', '>=', b[0]),
        where('originGeohash', '<=', b[1]),
        orderBy('originGeohash'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        this.ngZone.run(() => {
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const opportunity: SharedRideOpportunity = {
              opportunityId: change.doc.id,
              initiatorId: data['initiatorId'],
              initiatorName: data['initiatorName'],
              originGeohash: data['originGeohash'],
              destinationGeohash: data['destinationGeohash'],
              origin: data['origin'],
              destination: data['destination'],
              originAddress: data['originAddress'],
              destinationAddress: data['destinationAddress'],
              pathEncoded: data['pathEncoded'],
              estimatedPrice: data['estimatedPrice'],
              potentialDiscount: data['potentialDiscount'],
              status: data['status'],
              expiresAt: data['expiresAt']?.toDate(),
              createdAt: data['createdAt']?.toDate(),
              matchedRiders: data['matchedRiders'] || [],
              maxPassengers: data['maxPassengers'] || 4
            };

            // Filter out own opportunities and expired ones
            if (opportunity.initiatorId === riderId) return;
            if (opportunity.expiresAt && opportunity.expiresAt < new Date()) return;

            // Verify actual distance
            const oppLocation: [number, number] = [opportunity.origin.lat, opportunity.origin.lng];
            const distanceKm = distanceBetween(center, oppLocation);
            if (distanceKm > this.SEARCH_RADIUS_KM) return;

            if (change.type === 'removed') {
              allOpportunities.delete(change.doc.id);
            } else {
              allOpportunities.set(change.doc.id, opportunity);
            }
          });

          // Emit updated list
          const opportunities = Array.from(allOpportunities.values())
            .filter(o => o.status === 'open')
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          this.nearbyOpportunitiesSubject.next(opportunities);
        });
      }, (error) => {
        console.error('Error listening to opportunities:', error);
      });

      unsubscribes.push(unsub);
    }

    // Store unsubscribe function
    this.opportunitySubscription = () => {
      unsubscribes.forEach(unsub => unsub());
    };

    return this.nearbyOpportunities$;
  }

  /**
   * Unsubscribe from opportunity updates
   */
  unsubscribeFromOpportunities(): void {
    if (this.opportunitySubscription) {
      this.opportunitySubscription();
      this.opportunitySubscription = null;
    }
    this.nearbyOpportunitiesSubject.next([]);
  }

  /**
   * Accept a shared ride opportunity
   */
  async acceptOpportunity(
    opportunityId: string,
    riderId: string,
    riderName: string
  ): Promise<boolean> {
    try {
      const oppRef = doc(this.firestore, 'SharedRideOpportunities', opportunityId);
      const oppDoc = await getDoc(oppRef);

      if (!oppDoc.exists()) {
        throw new Error('Opportunity not found');
      }

      const data = oppDoc.data();

      // Check if still open
      if (data['status'] !== 'open') {
        throw new Error('Opportunity is no longer available');
      }

      // Check if expired
      if (data['expiresAt']?.toDate() < new Date()) {
        throw new Error('Opportunity has expired');
      }

      // Check if already at max passengers
      const currentMatched = data['matchedRiders'] || [];
      if (currentMatched.length >= (data['maxPassengers'] - 1)) {
        throw new Error('Ride is already full');
      }

      // Add rider to matched list
      const updatedMatched = [...currentMatched, riderId];

      // Calculate new discount (10% per passenger, max 40%)
      const newDiscount = Math.min((updatedMatched.length + 1) * 10, 40);

      await updateDoc(oppRef, {
        matchedRiders: updatedMatched,
        potentialDiscount: newDiscount,
        status: updatedMatched.length >= (data['maxPassengers'] - 1) ? 'matched' : 'open',
        updatedAt: Timestamp.now()
      });

      // Show success toast
      const toast = await this.toastController.create({
        message: `Joined shared ride! You'll save ${newDiscount}%`,
        duration: 3000,
        position: 'top',
        color: 'success'
      });
      await toast.present();

      return true;
    } catch (error) {
      console.error('Error accepting opportunity:', error);

      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Failed to join shared ride',
        duration: 3000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();

      return false;
    }
  }

  /**
   * Cancel/leave a shared ride opportunity
   */
  async leaveOpportunity(opportunityId: string, riderId: string): Promise<boolean> {
    try {
      const oppRef = doc(this.firestore, 'SharedRideOpportunities', opportunityId);
      const oppDoc = await getDoc(oppRef);

      if (!oppDoc.exists()) return false;

      const data = oppDoc.data();
      const currentMatched = data['matchedRiders'] || [];
      const updatedMatched = currentMatched.filter((id: string) => id !== riderId);

      // Recalculate discount
      const newDiscount = Math.min((updatedMatched.length + 1) * 10, 40);

      await updateDoc(oppRef, {
        matchedRiders: updatedMatched,
        potentialDiscount: newDiscount,
        status: 'open',
        updatedAt: Timestamp.now()
      });

      return true;
    } catch (error) {
      console.error('Error leaving opportunity:', error);
      return false;
    }
  }

  /**
   * Get a specific opportunity by ID
   */
  async getOpportunity(opportunityId: string): Promise<SharedRideOpportunity | null> {
    try {
      const oppRef = doc(this.firestore, 'SharedRideOpportunities', opportunityId);
      const oppDoc = await getDoc(oppRef);

      if (!oppDoc.exists()) return null;

      const data = oppDoc.data();
      return {
        opportunityId: oppDoc.id,
        initiatorId: data['initiatorId'],
        initiatorName: data['initiatorName'],
        originGeohash: data['originGeohash'],
        destinationGeohash: data['destinationGeohash'],
        origin: data['origin'],
        destination: data['destination'],
        originAddress: data['originAddress'],
        destinationAddress: data['destinationAddress'],
        pathEncoded: data['pathEncoded'],
        estimatedPrice: data['estimatedPrice'],
        potentialDiscount: data['potentialDiscount'],
        status: data['status'],
        expiresAt: data['expiresAt']?.toDate(),
        createdAt: data['createdAt']?.toDate(),
        matchedRiders: data['matchedRiders'] || [],
        maxPassengers: data['maxPassengers'] || 4
      };
    } catch (error) {
      console.error('Error getting opportunity:', error);
      return null;
    }
  }

  /**
   * Expire old opportunities (call periodically or via cloud function)
   */
  async expireOldOpportunities(): Promise<number> {
    try {
      const q = query(
        collection(this.firestore, 'SharedRideOpportunities'),
        where('status', '==', 'open'),
        where('expiresAt', '<', Timestamp.now())
      );

      const snapshot = await getDocs(q);
      let expiredCount = 0;

      for (const docSnap of snapshot.docs) {
        await updateDoc(docSnap.ref, {
          status: 'expired',
          updatedAt: Timestamp.now()
        });
        expiredCount++;
      }

      console.log(`Expired ${expiredCount} old opportunities`);
      return expiredCount;
    } catch (error) {
      console.error('Error expiring opportunities:', error);
      return 0;
    }
  }

  /**
   * Get general area name for privacy (don't show exact address)
   */
  getGeneralAreaFromAddress(address: string): string {
    // Extract city/neighborhood from full address
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts.slice(-2).join(',').trim();
    }
    return address;
  }
}
