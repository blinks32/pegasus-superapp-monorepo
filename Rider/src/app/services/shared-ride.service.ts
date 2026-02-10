import { Injectable } from '@angular/core';
import { Firestore, doc, collection, onSnapshot, updateDoc, getDoc, Unsubscribe } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { CoPassenger, SharedRide } from '../interfaces/rider';
import { ToastController } from '@ionic/angular';

export interface SharedRideNotification {
  type: 'matched' | 'discount_increased' | 'fare_updated' | 'pickup_queue' | 'passenger_cancelled';
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SharedRideService {
  private sharedRideSubject = new BehaviorSubject<SharedRide | null>(null);
  private notificationSubject = new BehaviorSubject<SharedRideNotification | null>(null);
  private unsubscribe: Unsubscribe | null = null;
  
  // Observable streams
  sharedRide$ = this.sharedRideSubject.asObservable();
  notifications$ = this.notificationSubject.asObservable();
  
  // Current state
  private currentSharedRide: SharedRide | null = null;
  private currentRiderId: string | null = null;

  constructor(
    private firestore: Firestore,
    private toastController: ToastController
  ) { }

  /**
   * Subscribe to a SharedRides document for real-time updates
   */
  subscribeToSharedRide(sharedRideId: string, riderId: string): Observable<SharedRide | null> {
    // Unsubscribe from any previous listener
    this.unsubscribeFromSharedRide();
    
    this.currentRiderId = riderId;
    
    const sharedRideRef = doc(this.firestore, 'SharedRides', sharedRideId);
    
    this.unsubscribe = onSnapshot(sharedRideRef, (snapshot) => {
      if (snapshot.exists()) {
        const newData = snapshot.data() as SharedRide;
        const previousData = this.currentSharedRide;
        
        // Check for changes and emit notifications
        this.checkForNotifications(previousData, newData);
        
        this.currentSharedRide = newData;
        this.sharedRideSubject.next(newData);
      } else {
        this.currentSharedRide = null;
        this.sharedRideSubject.next(null);
      }
    }, (error) => {
      console.error('Error listening to shared ride:', error);
      this.sharedRideSubject.next(null);
    });
    
    return this.sharedRide$;
  }

  /**
   * Unsubscribe from shared ride updates
   */
  unsubscribeFromSharedRide(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.currentSharedRide = null;
    this.currentRiderId = null;
    this.sharedRideSubject.next(null);
  }

  /**
   * Check for changes and emit notifications
   */
  private checkForNotifications(previous: SharedRide | null, current: SharedRide): void {
    // First time matched with shared ride
    if (!previous && current) {
      this.emitNotification({
        type: 'matched',
        message: 'You\'ve been matched with a shared ride! Save up to 40%.',
        data: { passengers: current.totalPassengers }
      });
      return;
    }

    if (!previous) return;

    // New passenger joined (discount increased)
    if (current.totalPassengers > previous.totalPassengers) {
      this.emitNotification({
        type: 'discount_increased',
        message: `New passenger joined! Your discount has increased.`,
        data: { 
          previousCount: previous.totalPassengers,
          newCount: current.totalPassengers
        }
      });
    }

    // Passenger cancelled (fare updated)
    if (current.totalPassengers < previous.totalPassengers) {
      this.emitNotification({
        type: 'passenger_cancelled',
        message: 'A passenger cancelled. Your fare has been updated.',
        data: {
          previousCount: previous.totalPassengers,
          newCount: current.totalPassengers
        }
      });
    }

    // Check for pickup queue position changes
    if (this.currentRiderId) {
      const previousPosition = this.getPickupPosition(previous.passengers, this.currentRiderId);
      const currentPosition = this.getPickupPosition(current.passengers, this.currentRiderId);
      
      if (previousPosition !== currentPosition && currentPosition > 0) {
        this.emitNotification({
          type: 'pickup_queue',
          message: currentPosition === 1 
            ? 'You\'re next for pickup!' 
            : `Driver picking up ${currentPosition - 1} passenger(s) first`,
          data: { position: currentPosition }
        });
      }
    }
  }

  /**
   * Get pickup position for a rider
   */
  private getPickupPosition(passengers: CoPassenger[], riderId: string): number {
    const passenger = passengers?.find(p => p.riderId === riderId);
    return passenger?.pickupOrder || 0;
  }

  /**
   * Emit a notification
   */
  private emitNotification(notification: SharedRideNotification): void {
    this.notificationSubject.next(notification);
    this.showToast(notification.message);
  }

  /**
   * Show toast notification
   */
  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'primary',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
   * Get current shared ride data
   */
  getCurrentSharedRide(): SharedRide | null {
    return this.currentSharedRide;
  }

  /**
   * Get co-passengers (excluding current rider)
   */
  getCoPassengers(): CoPassenger[] {
    if (!this.currentSharedRide || !this.currentRiderId) {
      return [];
    }
    return this.currentSharedRide.passengers.filter(p => p.riderId !== this.currentRiderId);
  }

  /**
   * Get current rider's pickup position
   */
  getMyPickupPosition(): number {
    if (!this.currentSharedRide || !this.currentRiderId) {
      return 0;
    }
    return this.getPickupPosition(this.currentSharedRide.passengers, this.currentRiderId);
  }

  /**
   * Get passengers being picked up before current rider
   */
  getPassengersBeforeMe(): number {
    const myPosition = this.getMyPickupPosition();
    return myPosition > 0 ? myPosition - 1 : 0;
  }

  /**
   * Calculate savings amount
   */
  calculateSavings(originalPrice: number, discountedPrice: number): number {
    return originalPrice - discountedPrice;
  }

  /**
   * Calculate discount percentage based on number of passengers
   * Max 40% discount with more passengers
   */
  calculateDiscountPercent(totalPassengers: number): number {
    // Base discount: 10% per additional passenger, max 40%
    const baseDiscount = 10;
    const additionalPassengers = totalPassengers - 1;
    return Math.min(additionalPassengers * baseDiscount, 40);
  }

  /**
   * Get potential savings range for display
   */
  getPotentialSavingsRange(originalPrice: number): { min: number; max: number } {
    return {
      min: originalPrice * 0.10, // 10% savings with 2 passengers
      max: originalPrice * 0.40  // 40% savings with max passengers
    };
  }

  /**
   * Cancel sharing after match - update SharedRide document
   */
  async cancelSharedRide(requestId: string, sharedRideId: string): Promise<void> {
    if (!this.currentRiderId) {
      console.error('No rider ID set');
      return;
    }

    try {
      // Update the Request document to remove sharing
      const requestRef = doc(this.firestore, 'Request', requestId);
      await updateDoc(requestRef, {
        sharedRideAccepted: false,
        isSharedRide: false,
        sharedRideId: null,
        discountedPrice: null,
        discountPercent: 0
      });

      // The SharedRides document should be updated by the backend/cloud function
      // to remove this passenger and recalculate other passengers' fares
      
      this.unsubscribeFromSharedRide();
    } catch (error) {
      console.error('Error cancelling shared ride:', error);
      throw error;
    }
  }

  /**
   * Check if sharing can be disabled (only before ride is confirmed)
   */
  canDisableSharing(rideStatus: string): boolean {
    return rideStatus === 'pending' || rideStatus === 'matching';
  }
}
