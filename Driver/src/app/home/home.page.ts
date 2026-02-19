import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { ModalController, Platform, NavController, ToastController, ActionSheetController, AlertController, ModalOptions } from '@ionic/angular';
import { OverlayService } from '../services/overlay.service';
import { GeocodeService } from '../services/geocode.service';
import { MapService } from '../services/map.service';
import { AvatarService } from '../services/avatar.service';
import { Drivers } from '../interfaces/drivers';
import { BehaviorSubject, interval, Observable, Subscription, timer } from 'rxjs';
import { doc, onSnapshot, Firestore, updateDoc, deleteField, getDoc, collection, addDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Marker, Polyline } from '@capacitor/google-maps';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { LatLng } from '@capacitor/google-maps/dist/typings/definitions';
import { LatLngLiteral } from '@googlemaps/google-maps-services-js';
import { switchMap } from 'rxjs/operators';
import { App } from '@capacitor/app';
import { EnrouteChatComponent } from '../enroute-chat/enroute-chat.component';
import { TranslateService } from '@ngx-translate/core';
import { TripSummaryComponent } from '../trip-summary/trip-summary.component';
import { Router } from '@angular/router';
import { RideSharingService } from '../services/ride-sharing.service';
import { SharedRide, SharedPassenger, Waypoint, RideMatchCandidate, RIDE_SHARING_CONFIG } from '../interfaces/shared-ride';
import { Rider } from '../interfaces/rider';
import { SettingsService } from '../services/settings.service';


declare var google;
declare var window: any; // Declare window to access BackgroundGeolocation

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit, OnDestroy {
  profile = null;
  @ViewChild('map') mapRef: ElementRef<HTMLElement>;
  private routeUpdateSubscription: Subscription;
  private settingsSubscription: Subscription;

  address: any = 'Unknown';
  bookingStage: any = false;
  confirmStage: any = false;
  trackingStage: any = false;
  drivingToDestinationStage: any = false;
  data: any;
  cash: any = false;
  state: any = [];
  mapPinStage: boolean;
  DestinationLatLng: { lat: any; lng: any; };
  mapPinDrag: any;
  showResetLocationButton: any = false;
  showloader: boolean;
  mapClass: any;
  destinationAddress: string = 'Drag To Pick Destination';
  locationAddress: string = 'Loading...';
  distance: any;
  direction: any;
  actualDestination: any;
  markers: any;
  allDrivers: Observable<Drivers[]>;
  NoDrivers: boolean;
  driverMarker: string;
  driver_duration_apart: number;
  driver_number_of_seats: any;
  price: any = 0;
  carname: any;
  driver_ID: any;
  bounds: any;
  DriverLatLng: { lat: any; lng: any; };
  driver_marker: any;
  driver_marker1: any;
  destinationMarker1: any;
  drivers_Requested: any[];
  current_Request_Number: number = -1;
  Driver_Rejected: any;
  numCalls: any;
  currentDriver: any;
  unsubscribe: import("@angular/fire/firestore").Unsubscribe;
  driverInfo: import("@angular/fire/firestore").DocumentData;
  currentState: boolean;
  duration: any;
  riderCleared: any;
  updateDriverSubcription: any;
  canCheck: boolean;
  rider_marker: any;
  marker1: any;
  marker2: any;
  actualLocation: string;
  LatLng: { lat: number; lng: number; };
  mapy: boolean;
  AllCarMarkers: Marker[];
  _carmarkers: any[];
  cards: import("@angular/fire/firestore").DocumentData[];
  selected: any;
  selectedCard: any;
  closeDrivers: any;
  approve: boolean = true;

  canStart: any;
  countDown: any;
  riderDestination: any;
  acceptedState: boolean = false;
  distanceText: any;
  durationText: any;
  driverCleared: boolean;
  FCOUNT: boolean;
  riderInfo: import("@angular/fire/firestore").DocumentData;
  earnings: any;
  coordinates: Position;
  driverData: import("@angular/fire/firestore").DocumentData;
  riderLocation: { lat: number, lng: number } | null = null;
  destinationMarker: string;
  newPoly: string[];
  animatedMarker: any;
  private countdownStarted = false;
  private countdownInterval: any;
  rideLostShown: boolean;
  isConnected: boolean;
  private networkStatus$ = new BehaviorSubject<boolean>(true);
  private router: Router;
  routePolyline: google.maps.Polyline;
  countdownTimer: number;
  localCountdown: number;
  countdownWatcher: import("@angular/fire/firestore").Unsubscribe;
  canShowButton: boolean = false;
  removed: any;
  backButtonSubscription: any;
  requestID: any;

  // Add these new variables to track different stages separately
  driverToRiderDistance: string;
  driverToRiderDuration: string;
  riderToDestinationDistance: string;
  riderToDestinationDuration: string;

  // Ride sharing variables
  isSharedRideMode: boolean = false;
  currentSharedRide: SharedRide | null = null;
  sharedRidePassengers: SharedPassenger[] = [];
  currentWaypoint: Waypoint | null = null;
  matchCandidates: RideMatchCandidate[] = [];
  showMatchCandidates: boolean = false;
  waypointMarkers: string[] = [];
  rideSharingEnabled: boolean = false;
  currencySymbol: string = '$';
  private matchPollingSubscription: Subscription | null = null;

  constructor(
    private auth: Auth,
    public map: MapService,
    private firestore: Firestore,
    private readonly database: AvatarService,
    private ngZone: NgZone,
    private geocode: GeocodeService,
    private overlay: OverlayService,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private platform: Platform,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private translate: TranslateService,
    private rideSharingService: RideSharingService,
    private settingsService: SettingsService
  ) {
    this.settingsSubscription = this.settingsService.settings$.subscribe(settings => {
      this.currencySymbol = settings.currencySymbol;
    });
  }

  ngOnDestroy() {
    this.stopBackgroundGeolocation();
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
    if (this.routeUpdateSubscription) {
      this.routeUpdateSubscription.unsubscribe();
    }
    if (this.newPoly) {
      this.clearPolyline(this.newPoly);
    }
  }

  async ngAfterViewInit() {
    try {
      this.EnterBookingStage();

      // Check and request geolocation permissions for native platforms
      if (this.platform.is('hybrid')) {
        const permissionStatus = await Geolocation.checkPermissions();

        if (permissionStatus.location !== 'granted') {
          // Show alert explaining why we need location access
          await this.showLocationPermissionAlert();
          await Geolocation.requestPermissions();
          // Continue even if denied - inner catch handles fallback
        }
      } else {
        console.log('Running on web, bypassing native Geolocation permission request');
      }

      let coordinates;
      try {
        // Prefer native navigator.geolocation on web for better reliability
        if (!this.platform.is('hybrid') && navigator.geolocation) {
          console.log('Using native web geolocation');
          coordinates = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed
                  },
                  timestamp: position.timestamp
                });
              },
              (error) => reject(error),
              { timeout: 10000, enableHighAccuracy: true }
            );
          });
        } else {
          console.log('Using Capacitor geolocation');
          coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        }
      } catch (geoError) {
        console.warn('Geolocation failed, trying fallback:', geoError);
        // Fallback to default (Kuala Lumpur)
        coordinates = {
          coords: {
            latitude: 3.1390,
            longitude: 101.6869,
            accuracy: 0,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        };
        this.overlay.showToast('Using default location. Please enable GPS for better accuracy.');
      }

      this.coordinates = coordinates;
      await this.initializeNetworkMonitoring();

      await this.fetchOnlineState();

      await this.map.createMap(this.mapRef.nativeElement, coordinates);
      this.ngZone.run(() => {
        this.mapy = true;
        this.actualLocation = this.map.actualLocation;
        this.locationAddress = this.map.locationAddress;
        console.log('Driver map initialized with address:', this.locationAddress);
      });

      this.initializeBackButtonCustomHandler();

      this.LatLng = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };
      this.database.updateDriverLocation(this.LatLng);

      this.DestinationLatLng = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };

      this.database.getEarnings().subscribe({
        next: async (d) => {
          const earnings = Number(d.Earnings ?? 0);
          this.earnings = Number.isFinite(earnings) ? Number(earnings.toFixed(2)) : 0;
        },
        error: (err) => {
          console.error('Error getting earnings:', err);
          this.earnings = 0;
        }
      });

      this.database.getCards().subscribe({
        next: async (d) => {
          this.cards = d;
          this.approve = false;
          this.cards.forEach((element) => {
            if (element.selected) {
              this.selected = element;
              this.selectedCard = element.name;
            }
          });
        },
        error: (err) => {
          console.error('Error getting cards:', err);
          this.cards = [];
          this.approve = false;
        }
      });

      await this.handleDriverRequestSnapshot();

      // Check if there's an active ride to restore
      await this.restoreActiveRide();

      this.map.newMap.setOnCameraIdleListener(() => {
        this.ngZone.run(() => {
          this.showResetLocationButton = true;
        });
      });


    } catch (e) {
      console.error('Error in Driver ngAfterViewInit:', e);
      if (!this.platform.is('hybrid') && (e.code === 1 || e.message?.includes('denied'))) {
        await this.showWebLocationRequiredAlert();
      } else if (e.code === 1) { // Permission denied error code
        await this.handleLocationPermissionDenied();
      } else if (e.message !== 'Location permission is required to use this app') {
        this.overlay.showAlert('Initialization Error', e.message || 'An unexpected error occurred');
      }
    }

    // Start polling position
    this.startPollingPosition();

    // Start background geolocation for mobile devices
    await this.checkPlatform();
  }


  private async initializeNetworkMonitoring() {
    const status = await Network.getStatus();
    this.isConnected = status.connected;
    this.networkStatus$.next(this.isConnected);
    console.log('Network monitoring initialized. Initial status:', this.isConnected);

    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed:', status);
      this.isConnected = status.connected;
      this.networkStatus$.next(this.isConnected);
    });

    this.networkStatus$.subscribe((isConnected) => {
      this.ngZone.run(() => {
        if (isConnected) {
          this.router.navigate(['/tabs']);
        } else {
          this.router.navigate(['/network']);
        }
      });
    });
  }


  initializeBackButtonCustomHandler() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });
  }

  handleBackButton() {
    if (this.bookingStage) {
      this.showExitConfirmation();
    } else if (this.confirmStage) {
      this.ResetState();
    } else if (this.trackingStage) {
      this.showCancelRideConfirmation();
    } else if (this.drivingToDestinationStage) {
      this.showCannotExitAlert();
    }
  }

  async showExitConfirmation() {
    const alert = await this.alertController.create({
      header: 'Exit App',
      message: 'Are you sure you want to exit the app?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Exit',
          handler: () => {
            navigator['app'].exitApp();
          }
        }
      ]
    });
    await alert.present();
  }

  async showCancelRideConfirmation() {
    const alert = await this.alertController.create({
      header: 'Cancel Ride',
      message: 'Are you sure you want to cancel this ride?',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes',
          handler: () => {
            // Implement logic to cancel the ride
            console.log('Ride cancelled');
            this.presentCancelRideActionSheet();
          }
        }
      ]
    });
    await alert.present();
  }

  async showCannotExitAlert() {
    const alert = await this.alertController.create({
      header: 'Cannot Exit',
      message: 'You cannot exit the app during an active trip.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async checkPlatform() {
    const info = await Device.getInfo();
    if (info.platform === 'ios' || info.platform === 'android') {
      this.startBackgroundGeolocation();
    }
  }

  async startPollingPosition() {
    const pollInterval = 5000; // Polling interval in milliseconds

    const updatePosition = async () => {
      try {
        let position;
        if (!this.platform.is('hybrid') && navigator.geolocation) {
          position = await new Promise<any>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
        } else {
          position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
        }

        this.DriverLatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.database.updateDriverLocation(this.DriverLatLng);
      } catch (error) {
        // console.error('Error getting position during polling:', error);
      }
      setTimeout(updatePosition, pollInterval); // Poll every pollInterval milliseconds
    };

    updatePosition();
  }


  async restoreActiveRide() {
    const user = this.auth.currentUser;
    if (user) {
      const driverDocRef = doc(this.firestore, 'Drivers', user.uid);
      const driverDoc = await getDoc(driverDocRef);
      const driverData = driverDoc.data();

      if (driverData && driverData.currentRequestId) {
        const requestRef = doc(this.firestore, 'Request', driverData.currentRequestId);
        const requestDoc = await getDoc(requestRef);
        const requestData = requestDoc.data();

        if (requestData && requestData.status !== 'done' && requestData.status !== 'cancelled') {
          // Restore the active ride state
          console.log('Restoring active ride with status:', requestData.status);
          this.riderInfo = requestData;
          this.requestID = driverData.currentRequestId;
          this.lastHandledState = requestData.status;

          // Restore the ride based on its current status
          await this.restoreRideState(requestData);
        } else {
          // Only clear if ride is completed or cancelled
          await this.clearCurrentRequestId(user.uid);
          this.lastHandledState = null;
          console.log('Cleared completed/cancelled ride on app restart.');
        }
      }
    }
  }

  async restoreRideState(requestData) {
    try {
      console.log('Restoring ride state for status:', requestData.status);

      // Set accepted state
      this.acceptedState = true;

      switch (requestData.status) {
        case 'pending':
          // Restore pending state (waiting for driver to accept)
          this.EnterConfirmStage();
          this.cash = !requestData.card;
          this.DestinationLatLng = {
            lat: requestData.Des_lat,
            lng: requestData.Des_lng,
          };
          await this.getDistanceandDirections();
          this.map.newMap.enableCurrentLocation(false);
          break;

        case 'confirmed':
          // Restore tracking stage (driver going to pick up rider)
          await this.getRiderLocation(requestData.Rider_id);
          this.DestinationLatLng = {
            lat: this.riderLocation?.lat ?? requestData.Loc_lat,
            lng: this.riderLocation?.lng ?? requestData.Loc_lng,
          };
          await this.handleDriverToRider(this.DriverLatLng, this.DestinationLatLng);
          // Keep online if in shared ride mode
          const stayOnlineConfirmed = this.isSharedRideMode && this.rideSharingEnabled;
          await this.database.updateOnlineState(stayOnlineConfirmed);
          if (stayOnlineConfirmed) await this.database.updateAvailableForSharing(true);
          break;

        case 'started':
          // Restore driving to destination stage (rider is in car)
          this.DestinationLatLng = {
            lat: requestData.Des_lat,
            lng: requestData.Des_lng,
          };
          await this.handleRiderToDestination(this.DriverLatLng, this.DestinationLatLng);
          // Keep online if in shared ride mode
          const stayOnlineStarted = this.isSharedRideMode && this.rideSharingEnabled;
          await this.database.updateOnlineState(stayOnlineStarted);
          if (stayOnlineStarted) await this.database.updateAvailableForSharing(true);
          break;

        default:
          console.warn('Unknown ride status to restore:', requestData.status);
          break;
      }

      console.log('Ride state restored successfully');
    } catch (error) {
      console.error('Error restoring ride state:', error);
      this.overlay.showAlert('Error', 'Failed to restore previous ride. Please contact support.');
    }
  }

  async startBackgroundGeolocation() {
    try {
      const info = await Device.getInfo();

      // Only proceed with background geolocation setup on mobile devices
      if (info.platform === 'ios' || info.platform === 'android') {
        if (!window.BackgroundGeolocation) {
          console.warn('BackgroundGeolocation is not available on this platform');
          return;
        }

        const options = {
          stationaryRadius: 50,
          distanceFilter: 50,
          desiredAccuracy: 10,
          debug: true,
          notificationTitle: 'Background tracking',
          notificationText: 'enabled',
          startOnBoot: true,
          stopOnTerminate: false,
          locationProvider: window.BackgroundGeolocation.provider.ANDROID_ACTIVITY_PROVIDER,
          interval: 60000,
          fastestInterval: 5000,
          activitiesInterval: 10000,
          stopOnStillActivity: false,
        };

        window.BackgroundGeolocation.configure(options);

        window.BackgroundGeolocation.on('location', (location) => {
          console.log('Location update: ', location);
          this.DriverLatLng = {
            lat: location.latitude,
            lng: location.longitude,
          };
          this.database.updateDriverLocation(this.DriverLatLng);
        });

        window.BackgroundGeolocation.start();
      } else {
        // For web platform, just use regular position polling
        console.log('Using regular position polling for web platform');
        this.startPollingPosition();
      }
    } catch (e) {
      console.error('BackgroundGeolocation configuration error: ', e);
      // Fallback to regular position polling on error
      this.startPollingPosition();
    }
  }

  async stopBackgroundGeolocation() {
    const info = await Device.getInfo();
    if ((info.platform === 'ios' || info.platform === 'android') && window.BackgroundGeolocation) {
      window.BackgroundGeolocation.stop();
    }
  }


  getRiderLocation(driverId: string): void {
    this.database.getRiderLocation(driverId)
      .then(location => {
        this.riderLocation = location;
        this.DestinationLatLng = {
          lat: this.riderLocation.lat,
          lng: this.riderLocation.lng,
        };
        console.log(this.riderLocation); // For testing purposes
      })
      .catch(error => {
        console.error('Error fetching driver location:', error);
      });
  }


  lastHandledState: string | null = null;

  private driverRequestUnsubscribe: () => void;

  async handleDriverRequestSnapshot() {
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        const driverDocRef = doc(this.firestore, 'Drivers', user.uid);
        onSnapshot(driverDocRef, async (driverDoc) => {
          this.driverData = driverDoc.data();
          if (this.driverData && this.driverData.currentRequestId) {
            const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);

            // Unsubscribe from previous listener to prevent duplicates
            if (this.driverRequestUnsubscribe) {
              this.driverRequestUnsubscribe();
              this.driverRequestUnsubscribe = null;
            }

            this.driverRequestUnsubscribe = onSnapshot(requestRef, async (doc) => {
              console.log("It happened Here", doc.data());
              this.riderInfo = doc.data();
              if (this.riderInfo && this.lastHandledState !== this.riderInfo.status) {
                console.log("Should trigger", this.riderInfo.status);
                this.lastHandledState = this.riderInfo.status; // Update the last handled state
                switch (this.riderInfo.status) {
                  case 'cancelled':
                    await this.handleCancelledState(this.riderInfo);
                    break;
                  case 'pending':
                    await this.handlePendingState(this.riderInfo);
                    break;
                  case 'confirmed':
                    await this.handleConfirmedState(this.riderInfo);
                    break;
                  case 'started':
                    await this.handleStartedState(this.riderInfo);
                    break;
                  case 'done':
                    await this.handleStoppedState(this.riderInfo);
                    break;
                  default:
                    console.error('Unknown ride status:', this.riderInfo.status);
                    break;
                }
              }
            });
          }
        });
      }
    });
  }



  async handlePendingState(doco) {
    try {

      console.log('Handling the pending state:', doco);
      const userDocRef = doc(this.firestore, `Riders`, doco.Rider_id);

      const docSnapshot = await getDoc(userDocRef);

      if (docSnapshot.exists()) {
        console.log("I'm here!!!!!!!!!!");

        if (!this.acceptedState) {
          if (!this.countdownStarted) {
            this.countdownStarted = true; // Flag to ensure countdown starts only once

            // Initial state setup
            this.EnterConfirmStage();
            this.cash = !doco.card;

            this.DestinationLatLng = {
              lat: this.riderInfo.Des_lat,
              lng: this.riderInfo.Des_lng,
            };

            this.getDistanceandDirections();
            this.map.newMap.enableCurrentLocation(false);

            // Start the countdown watcher
            this.watchCountdown(doco);
          }
        }
      }
    } catch (e) {
      this.overlay.showAlert('Confirm Error', e);
    }
  }


  watchCountdown(doco) {
    const requestRef = doc(this.firestore, 'Request', doco.requestId);
    this.requestID = doco.requestId;

    const countdownWatcher = onSnapshot(requestRef, async (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const currentCountdown = data.countDown;

        console.log('Current countdown:', currentCountdown);

        if (currentCountdown <= 1) {
          if (this.auth.currentUser) {
            await this.clearCurrentRequestId(this.auth.currentUser.uid);
          }
          this.ClearRide();
          this.FCOUNT = true;
          this.lastHandledState = null;
          this.overlay.showAlert('Lost', 'Ride Lost');
          countdownWatcher(); // Unsubscribe from changes
          this.acceptedState = false;
        }
      } else {
        console.error('Ride request document does not exist.');
      }
    });

    this.countdownWatcher = countdownWatcher; // Store the unsubscribe function if needed
  }




  async UpdateCountDown(time, requestId) {
    try {
      const requestDocRef = doc(this.firestore, "Request", requestId);
      await updateDoc(requestDocRef, { countDown: time });
      return true;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  async startCountdown(initialTime, requestId) {
    let timeRemaining = initialTime;

    const updateCountdown = async () => {
      if (timeRemaining > 0) {
        await this.UpdateCountDown(timeRemaining, requestId);
        // this.updatePieChart(timeRemaining, initialTime);
        timeRemaining--;
        setTimeout(updateCountdown, 1000); // Update every second
      }
    };

    updateCountdown();
  }




  async completeRideAndProcessPayment(doc) {
    // Complete the ride, process payment, and update ride history
    const rideData = doc;
    console.log("This is the ride data: ", rideData)
    await this.processPayment(rideData);
    await this.updateRideHistory(rideData);


  }

  async processPayment(rideData) {
    // Logic to process payment
    console.log('Processing payment for ride:', rideData);
    // Example: Call a payment API and update Firestore with payment status
    const Drivershare = (80 / 100) * rideData.price;
    const amt = rideData.price - Drivershare;
    await this.database.updateEarnings(amt + this.earnings)
  }

  async updateRideHistory(rideData) {
    // Logic to update ride history
    console.log('Updating ride history for ride:', rideData);
    // Example: Add ride data to a 'RideHistory' collection in Firestore
    await this.database.createHistory(rideData);

  }

  // ==================== RIDE SHARING METHODS ====================

  /**
   * Initialize ride sharing mode for a new ride
   */
  async initializeSharedRide(riderInfo: any): Promise<void> {
    if (!this.rideSharingEnabled || !this.driverData) return;

    try {
      const rider: Rider = {
        Loc_lat: riderInfo.Loc_lat,
        Loc_lng: riderInfo.Loc_lng,
        Rider_id: riderInfo.Rider_id,
        Rider_name: riderInfo.Rider_name,
        Rider_email: riderInfo.Rider_email,
        Rider_phone: riderInfo.Rider_phone,
        Rider_imgUrl: riderInfo.Rider_imgUrl,
        Rider_rating: riderInfo.Rider_rating || 5,
        Des_lat: riderInfo.Des_lat,
        Des_lng: riderInfo.Des_lng,
        Rider_Location: riderInfo.Rider_Location,
        Rider_Destination: riderInfo.Rider_Destination,
        countDown: riderInfo.countDown,
        cancel: false,
        price: riderInfo.price,
        cash: riderInfo.cash,
        time: riderInfo.time,
        requestId: this.driverData.currentRequestId
      };

      this.currentSharedRide = await this.rideSharingService.createSharedRide(
        this.auth.currentUser.uid,
        this.driverData.Driver_name || 'Driver',
        rider,
        this.driverData.Driver_cartype || 'Standard',
        this.driverData.seats || 4,
        this.driverData.rideSharingPreferences?.maxPassengers || RIDE_SHARING_CONFIG.MAX_PASSENGERS_DEFAULT
      );

      this.isSharedRideMode = true;
      this.sharedRidePassengers = this.currentSharedRide.passengers;

      // Set current waypoint immediately
      this.currentWaypoint = this.rideSharingService.getNextWaypoint(this.currentSharedRide);
      console.log('Initial currentWaypoint:', this.currentWaypoint);

      // Subscribe to shared ride updates
      this.rideSharingService.subscribeToSharedRide(this.currentSharedRide.sharedRideId);

      // Subscribe to shared ride observable
      this.rideSharingService.getCurrentSharedRide().subscribe(sharedRide => {
        if (sharedRide) {
          this.currentSharedRide = sharedRide;
          this.sharedRidePassengers = sharedRide.passengers;
          this.currentWaypoint = this.rideSharingService.getNextWaypoint(sharedRide);
          this.cdr.detectChanges();
        }
      });

      console.log('Shared ride initialized:', this.currentSharedRide.sharedRideId);
    } catch (error) {
      console.error('Error initializing shared ride:', error);
      this.isSharedRideMode = false;
    }
  }

  /**
   * Check if driver has ride sharing enabled
   */
  async checkRideSharingEnabled(): Promise<void> {
    if (this.driverData?.rideSharingEnabled) {
      this.rideSharingEnabled = true;
    } else {
      this.rideSharingEnabled = false;
    }
  }

  /**
   * Find and display potential match candidates for shared ride
   */
  async findSharedRideMatches(): Promise<void> {
    if (!this.isSharedRideMode || !this.currentSharedRide) {
      console.log('findSharedRideMatches - not in shared ride mode or no current shared ride');
      return;
    }

    try {
      console.log('Searching for match candidates...');
      const candidates = await this.rideSharingService.findMatchCandidates(
        this.auth.currentUser.uid,
        this.DriverLatLng.lat,
        this.DriverLatLng.lng
      );

      console.log('Found candidates:', candidates.length);
      this.matchCandidates = candidates;
      if (candidates.length > 0) {
        this.showMatchCandidates = true;
        await this.showMatchNotification(candidates.length);
      }
    } catch (error) {
      console.error('Error finding match candidates:', error);
    }
  }

  /**
   * Start periodic polling for match candidates
   */
  startMatchPolling(): void {
    // Stop any existing polling
    this.stopMatchPolling();

    console.log('Starting match polling every 15 seconds...');

    // Poll every 15 seconds for new match candidates
    this.matchPollingSubscription = interval(15000).subscribe(() => {
      if (this.isSharedRideMode && this.currentSharedRide) {
        this.findSharedRideMatches();
      } else {
        this.stopMatchPolling();
      }
    });
  }

  /**
   * Stop polling for match candidates
   */
  stopMatchPolling(): void {
    if (this.matchPollingSubscription) {
      console.log('Stopping match polling');
      this.matchPollingSubscription.unsubscribe();
      this.matchPollingSubscription = null;
    }
  }

  /**
   * Show notification for available ride matches
   */
  async showMatchNotification(count: number): Promise<void> {
    const toast = await this.toastController.create({
      message: `${count} passenger(s) going your way! Tap to add.`,
      duration: 5000,
      position: 'top',
      color: 'success',
      buttons: [
        {
          text: 'View',
          handler: () => {
            this.showMatchCandidates = true;
          }
        }
      ]
    });
    await toast.present();
  }

  /**
   * Accept a match candidate and add to shared ride
   */
  async acceptMatchCandidate(candidate: RideMatchCandidate): Promise<void> {
    if (!this.currentSharedRide) return;

    try {
      this.overlay.showLoader('Adding passenger...');

      // Get the full rider info from the request
      const requestDoc = await getDoc(doc(this.firestore, 'Request', candidate.requestId));
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }

      const riderInfo = requestDoc.data() as Rider;
      riderInfo.requestId = candidate.requestId;

      await this.rideSharingService.addPassengerToSharedRide(
        this.currentSharedRide.sharedRideId,
        riderInfo,
        this.DriverLatLng.lat,
        this.DriverLatLng.lng
      );

      // Update the request status with full driver information so rider app can display it
      await updateDoc(doc(this.firestore, 'Request', candidate.requestId), {
        status: 'confirmed',
        sharedRideId: this.currentSharedRide.sharedRideId,
        driverId: this.auth.currentUser.uid,
        Driver_id: this.auth.currentUser.uid,
        Driver_name: this.driverData?.Driver_name || 'Driver',
        Driver_imgUrl: this.driverData?.Driver_imgUrl || '',
        Driver_phone: this.driverData?.Driver_phone || '',
        Driver_cartype: this.driverData?.Driver_cartype || '',
        Driver_plate: this.driverData?.Driver_plate || '',
        Driver_rating: this.driverData?.Driver_rating || 5,
        isSharedRide: true
      });

      // Remove from candidates list
      this.matchCandidates = this.matchCandidates.filter(c => c.requestId !== candidate.requestId);

      // Update map with new waypoints
      await this.updateSharedRideWaypoints();

      this.overlay.hideLoader();

      const toast = await this.toastController.create({
        message: `${candidate.riderName} added to your ride!`,
        duration: 3000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      this.overlay.hideLoader();
      console.error('Error accepting match:', error);
      this.overlay.showAlert('Error', 'Failed to add passenger');
    }
  }

  /**
   * Decline a match candidate
   */
  declineMatchCandidate(candidate: RideMatchCandidate): void {
    this.matchCandidates = this.matchCandidates.filter(c => c.requestId !== candidate.requestId);
    if (this.matchCandidates.length === 0) {
      this.showMatchCandidates = false;
    }
  }

  /**
   * Update map markers for all shared ride waypoints
   */
  async updateSharedRideWaypoints(): Promise<void> {
    if (!this.currentSharedRide) return;

    // Clear existing waypoint markers
    for (const markerId of this.waypointMarkers) {
      try {
        await this.map.newMap.removeMarker(markerId);
      } catch (e) {
        console.log('Marker already removed');
      }
    }
    this.waypointMarkers = [];

    // Add markers for each waypoint
    for (const waypoint of this.currentSharedRide.route.waypoints) {
      if (waypoint.completed) continue;

      const iconUrl = waypoint.type === 'pickup'
        ? 'assets/icon/pickup-marker.png'
        : 'assets/icon/dropoff-marker.png';

      try {
        const marker = await this.map.newMap.addMarker({
          coordinate: { lat: waypoint.lat, lng: waypoint.lng },
          iconUrl: iconUrl,
          title: `${waypoint.type === 'pickup' ? 'Pick up' : 'Drop off'} ${waypoint.riderName}`,
          iconSize: { width: 30, height: 30 }
        });
        this.waypointMarkers.push(marker);
      } catch (e) {
        console.error('Error adding waypoint marker:', e);
      }
    }
  }

  /**
   * Complete current waypoint (pickup or dropoff)
   */
  async completeCurrentWaypoint(): Promise<void> {
    if (!this.currentSharedRide || !this.currentWaypoint) return;

    try {
      const waypointIndex = this.currentSharedRide.route.waypoints.findIndex(
        wp => wp.riderId === this.currentWaypoint.riderId &&
          wp.type === this.currentWaypoint.type &&
          !wp.completed
      );

      if (waypointIndex === -1) return;

      // Check if this is the last waypoint (final dropoff)
      const remainingWaypoints = this.currentSharedRide.route.waypoints.filter(wp => !wp.completed);
      const isLastWaypoint = remainingWaypoints.length === 1;
      const completedWaypointType = this.currentWaypoint.type;
      const completedRiderName = this.currentWaypoint.riderName;
      const completedRiderId = this.currentWaypoint.riderId;

      // Complete waypoint in shared ride and get the request info
      const waypointResult = await this.rideSharingService.completeWaypoint(
        this.currentSharedRide.sharedRideId,
        waypointIndex
      );

      // Update the individual Request document so the rider gets notified
      if (waypointResult && waypointResult.requestId) {
        const requestRef = doc(this.firestore, 'Request', waypointResult.requestId);
        if (waypointResult.type === 'pickup') {
          // Update request status to 'started' for pickup
          await updateDoc(requestRef, {
            status: 'started',
            pickedUpAt: new Date().toISOString()
          });
          console.log(`Updated Request ${waypointResult.requestId} to started for rider ${waypointResult.riderId}`);
        } else if (waypointResult.type === 'dropoff') {
          // Update request status to 'done' for dropoff
          await updateDoc(requestRef, {
            status: 'done',
            droppedOffAt: new Date().toISOString()
          });
          console.log(`Updated Request ${waypointResult.requestId} to done for rider ${waypointResult.riderId}`);
        }
      } else {
        // Fallback: Try to find the requestId from the passenger list
        const passenger = this.currentSharedRide.passengers.find(p => p.riderId === completedRiderId);
        if (passenger?.requestId) {
          const requestRef = doc(this.firestore, 'Request', passenger.requestId);
          if (completedWaypointType === 'pickup') {
            await updateDoc(requestRef, {
              status: 'started',
              pickedUpAt: new Date().toISOString()
            });
          } else if (completedWaypointType === 'dropoff') {
            await updateDoc(requestRef, {
              status: 'done',
              droppedOffAt: new Date().toISOString()
            });
          }
          console.log(`Updated Request ${passenger.requestId} via fallback for rider ${completedRiderId}`);
        }
      }

      // If this was the last waypoint, complete the ride normally
      if (isLastWaypoint) {
        console.log('Last waypoint completed - finishing ride');
        // The Request document was already updated above to 'done'
        return; // The handleStoppedState will handle the rest
      }

      // Show notification for completed waypoint
      if (completedWaypointType === 'dropoff') {
        // Dropped off a passenger but more waypoints remain
        const remainingDropoffs = remainingWaypoints.filter(wp => wp.type === 'dropoff').length - 1;
        const remainingPickups = remainingWaypoints.filter(wp => wp.type === 'pickup').length;

        let message = `${completedRiderName} dropped off! `;
        if (remainingPickups > 0) {
          message += `${remainingPickups} pickup(s) remaining. `;
        }
        if (remainingDropoffs > 0) {
          message += `${remainingDropoffs} more dropoff(s) to go.`;
        }

        const toast = await this.toastController.create({
          message: message,
          duration: 4000,
          position: 'top',
          color: 'success',
          buttons: [{ text: 'OK', role: 'cancel' }]
        });
        await toast.present();
      } else if (completedWaypointType === 'pickup') {
        // Picked up a passenger
        const toast = await this.toastController.create({
          message: `${completedRiderName} picked up!`,
          duration: 2000,
          position: 'top',
          color: 'success'
        });
        await toast.present();
      }

      // Update local state
      this.currentWaypoint = this.rideSharingService.getNextWaypoint(this.currentSharedRide);

      // Update map
      await this.updateSharedRideWaypoints();

      // Navigate to next waypoint if exists
      if (this.currentWaypoint) {
        await this.navigateToWaypoint(this.currentWaypoint);

        // Notify driver of next action
        const nextAction = this.currentWaypoint.type === 'pickup' ? 'pick up' : 'drop off';
        const nextToast = await this.toastController.create({
          message: `Next: ${nextAction} ${this.currentWaypoint.riderName}`,
          duration: 3000,
          position: 'bottom',
          color: 'primary'
        });
        await nextToast.present();
      }
    } catch (error) {
      console.error('Error completing waypoint:', error);
    }
  }

  /**
   * Navigate to a specific waypoint
   */
  async navigateToWaypoint(waypoint: Waypoint): Promise<void> {
    const destination = { lat: waypoint.lat, lng: waypoint.lng };

    // Update destination display
    this.riderDestination = waypoint.address;

    // Clear existing polyline
    if (this.newPoly) {
      await this.clearPolyline(this.newPoly);
    }

    // Draw new route
    await this.addPolyline(this.DriverLatLng, destination);
  }

  /**
   * Get passengers currently in vehicle
   */
  getPassengersInVehicle(): SharedPassenger[] {
    if (!this.currentSharedRide) return [];
    return this.rideSharingService.getPassengersInVehicle(this.currentSharedRide);
  }

  /**
   * Get passengers waiting to be picked up
   */
  getPassengersWaiting(): SharedPassenger[] {
    if (!this.currentSharedRide) return [];
    return this.rideSharingService.getPassengersWaiting(this.currentSharedRide);
  }

  /**
   * Calculate total fare for shared ride
   */
  getSharedRideTotalFare(): number {
    if (!this.currentSharedRide) return 0;
    return this.currentSharedRide.totalFareCollected;
  }

  /**
   * Get driver earnings for shared ride
   */
  getSharedRideDriverEarnings(): number {
    if (!this.currentSharedRide) return 0;
    return this.currentSharedRide.driverEarnings;
  }

  /**
   * Complete the shared ride and process all payments
   */
  async completeSharedRide(): Promise<void> {
    if (!this.currentSharedRide) return;

    try {
      // Process payments for all passengers
      for (const passenger of this.currentSharedRide.passengers) {
        if (passenger.status === 'dropped_off') {
          const paymentData = {
            price: passenger.discountedPrice,
            originalPrice: passenger.originalPrice,
            discount: passenger.discountPercent,
            riderId: passenger.riderId,
            riderName: passenger.riderName
          };
          await this.processPayment(paymentData);
        }
      }

      // Update earnings with total driver share
      await this.database.updateEarnings(this.currentSharedRide.driverEarnings + this.earnings);

      // Clean up
      this.rideSharingService.unsubscribeFromSharedRide();
      this.isSharedRideMode = false;
      this.currentSharedRide = null;
      this.sharedRidePassengers = [];
      this.currentWaypoint = null;
      this.matchCandidates = [];
      this.showMatchCandidates = false;

      // Clear waypoint markers
      for (const markerId of this.waypointMarkers) {
        try {
          await this.map.newMap.removeMarker(markerId);
        } catch (e) { }
      }
      this.waypointMarkers = [];

    } catch (error) {
      console.error('Error completing shared ride:', error);
    }
  }

  /**
   * Cancel a passenger from shared ride
   */
  async cancelPassengerFromSharedRide(riderId: string, reason: string): Promise<void> {
    if (!this.currentSharedRide) return;

    try {
      await this.rideSharingService.cancelPassengerFromSharedRide(
        this.currentSharedRide.sharedRideId,
        riderId,
        reason
      );

      await this.updateSharedRideWaypoints();

      const toast = await this.toastController.create({
        message: 'Passenger removed from ride',
        duration: 2000,
        color: 'warning'
      });
      await toast.present();
    } catch (error) {
      console.error('Error canceling passenger:', error);
    }
  }

  // ==================== END RIDE SHARING METHODS ====================


  async clearCurrentRequestId(driverId: string) {
    const driverDocRef = doc(this.firestore, 'Drivers', driverId);
    await updateDoc(driverDocRef, {
      currentRequestId: deleteField()
    });
  }

  async handleConfirmedState(doc) {
    try {
      await this.ResetState();
      await this.getRiderLocation(this.riderInfo.Rider_id);

      this.DestinationLatLng = {
        lat: (this.riderLocation?.lat) ?? this.riderInfo.Loc_lat,
        lng: (this.riderLocation?.lng) ?? this.riderInfo.Loc_lng,
      };

      // Show a more specific message
      this.overlay.showLoader('Navigating to rider...');

      // Check if we should stay online for ride sharing
      // Use rideSharingEnabled as primary check since isSharedRideMode may not be set yet
      const shouldStayOnline = this.rideSharingEnabled || (this.isSharedRideMode && !!this.currentSharedRide);
      console.log('handleConfirmedState - rideSharingEnabled:', this.rideSharingEnabled, 'isSharedRideMode:', this.isSharedRideMode, 'shouldStayOnline:', shouldStayOnline);

      // Pre-fetch data and setup markers concurrently
      await Promise.all([
        this.handleDriverToRider(this.DriverLatLng, this.DestinationLatLng),
        this.database.updateOnlineState(shouldStayOnline), // Stay online if sharing enabled
        shouldStayOnline ? this.database.updateAvailableForSharing(true) : Promise.resolve()
      ]);

      // If ridesharing is enabled, look for matching passengers
      if (shouldStayOnline) {
        console.log('Shared ride mode active - searching for matching passengers...');
        // Delay initial match finding to allow navigation to settle
        setTimeout(() => {
          this.findSharedRideMatches();
          // Start periodic polling for new match candidates
          this.startMatchPolling();
        }, 3000);
      }
    } catch (error) {
      console.error('Error in handleConfirmedState:', error);
      this.overlay.showAlert('Error', 'Failed to initialize navigation');
    }
  }



  async handleStartedState(doc) {
    try {
      await this.ResetState();

      this.DestinationLatLng = {
        lat: doc.Des_lat,
        lng: doc.Des_lng,
      };

      // Show a more specific message
      this.overlay.showLoader('Starting trip...');

      // Check if we should stay online for ride sharing
      const shouldStayOnline = this.rideSharingEnabled || (this.isSharedRideMode && !!this.currentSharedRide);
      console.log('handleStartedState - rideSharingEnabled:', this.rideSharingEnabled, 'isSharedRideMode:', this.isSharedRideMode, 'shouldStayOnline:', shouldStayOnline);

      // Pre-fetch data and setup markers concurrently
      await Promise.all([
        this.handleRiderToDestination(this.DriverLatLng, this.DestinationLatLng),
        this.database.updateOnlineState(shouldStayOnline), // Stay online if sharing enabled
        shouldStayOnline ? this.database.updateAvailableForSharing(true) : Promise.resolve()
      ]);

      // If ridesharing is enabled, start the shared ride and look for more matches
      if (this.isSharedRideMode && this.currentSharedRide) {
        console.log('Trip started in shared ride mode - starting shared ride and looking for matches...');
        await this.rideSharingService.startSharedRide(this.currentSharedRide.sharedRideId);
        // Look for additional passengers going the same way
        setTimeout(() => {
          this.findSharedRideMatches();
        }, 5000);
      }
    } catch (error) {
      console.error('Error in handleStartedState:', error);
      this.overlay.showAlert('Error', 'Failed to start trip');
    }
  }

  async handleStoppedState(doc) {
    // Clear the ride from driver's current requests
    if (this.auth.currentUser) {
      await this.clearCurrentRequestId(this.auth.currentUser.uid);
    }

    // Unsubscribe from the current request listener
    if (this.driverRequestUnsubscribe) {
      this.driverRequestUnsubscribe();
    }

    // Clean up shared ride state if in shared ride mode
    if (this.isSharedRideMode && this.currentSharedRide) {
      console.log('Cleaning up shared ride state...');
      this.stopMatchPolling(); // Stop polling for matches
      this.rideSharingService.unsubscribeFromSharedRide();
      this.isSharedRideMode = false;
      this.currentSharedRide = null;
      this.sharedRidePassengers = [];
      this.currentWaypoint = null;
      this.matchCandidates = [];
      this.showMatchCandidates = false;
    }

    // Clear availableForSharing flag
    await this.database.updateAvailableForSharing(false);

    this.clearPrevMarkers()
    if (this.newPoly) {
      await this.clearPolyline(this.newPoly);
    }

    // Show trip summary modal before returning to home
    await this.showTripSummary(doc);

    // Complete the ride and process payment
    await this.completeRideAndProcessPayment(doc);
    await this.database.updateOnlineState(true);
    this.map.newMap.enableCurrentLocation(true);

    // Reset ride states to allow new ride requests
    this.acceptedState = false;
    this.lastHandledState = null;
    this.countdownStarted = false;
  }

  async showTripSummary(doc) {
    // Use this.requestID if available, otherwise try to get it from the trip data
    const requestIdToUse = this.requestID || this.driverData?.currentRequestId || doc.requestId;

    const modal = await this.modalCtrl.create({
      component: TripSummaryComponent,
      componentProps: {
        tripData: doc,
        requestId: requestIdToUse
      },
      cssClass: 'trip-summary-modal',
      backdropDismiss: false
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    // After modal is dismissed, return to home
    this.EnterBookingStage();
    await this.ReturnHome();
  }

  async handleCancelledState(data) {
    console.log(`Ride was cancelled by ${data.canceledBy} for reason: ${data.cancellationReason}`);

    if (data.canceledBy == 'rider') {
      this.overlay.showAlert('Cancelled', 'Rider cancelled');
    }

    // Clean up shared ride state if in shared ride mode
    if (this.isSharedRideMode && this.currentSharedRide) {
      console.log('Cleaning up shared ride state after cancellation...');
      this.stopMatchPolling(); // Stop polling for matches
      this.rideSharingService.unsubscribeFromSharedRide();
      this.isSharedRideMode = false;
      this.currentSharedRide = null;
      this.sharedRidePassengers = [];
      this.currentWaypoint = null;
      this.matchCandidates = [];
      this.showMatchCandidates = false;
    }

    // Clear availableForSharing flag
    await this.database.updateAvailableForSharing(false);

    this.ClearRide();
    this.removed = true;
    console.log('Ride is cancelled.');

    // Reset all ride states to allow new ride requests
    this.acceptedState = false;
    this.lastHandledState = null;
    this.countdownStarted = false;

    // Clear currentRequestId in driverData
    const driverDocRef = doc(this.firestore, 'Drivers', this.auth.currentUser.uid);
    await updateDoc(driverDocRef, { currentRequestId: null });
    await this.database.updateOnlineState(true);
    await this.fetchOnlineState()
  }


  async EnterChat(): Promise<void> {
    const options: ModalOptions = {
      component: EnrouteChatComponent,
      componentProps: {
        userId: this.requestID,
        message: ""
      },
      swipeToClose: true,
    };

    const modal = await this.modalCtrl.create(options);
    return await modal.present();
  }


  startTimer(sec) {
    const nop = interval(1000).subscribe(async () => {
      await this.database.updateCountDown(sec);
      sec--;
      if (sec == 0) {
        nop.unsubscribe();
      }
    });
  }

  async chooseCard(event) {
    try {
      this.overlay.showLoader('Selecting Card..');
      await this.database.updateCard(this.selected.name, this.selected.number, this.selected.type, this.selected.id, false);
      for (const element of this.cards) {
        if (element.name == event) {
          await this.database.updateCard(element.name, element.number, element.type, element.id, true);
          this.overlay.hideLoader();
        }
      }
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async AcceptRide() {
    try {
      this.acceptedState = true;

      // Initialize shared ride mode BEFORE updating status
      // This ensures isSharedRideMode is set when handleConfirmedState runs
      await this.checkRideSharingEnabled();
      if (this.rideSharingEnabled && this.riderInfo) {
        console.log('Ridesharing enabled - initializing shared ride mode');
        await this.initializeSharedRide(this.riderInfo);
      }

      // Now update the request status (this triggers handleConfirmedState)
      const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
      await updateDoc(requestRef, { status: 'confirmed' });
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
      // Retry or provide user feedback
    }
  }

  async resetLocation(): Promise<void> {
    await this.map.newMap.setCamera({
      animate: true,
      animationDuration: 500,
      zoom: 15,
      coordinate: this.LatLng,
    });
    this.showResetLocationButton = false;
  }

  async PickUp() {
    try {
      this.canShowButton = false;
      this.overlay.showLoader('Picking Up..');

      // In shared ride mode, use completeCurrentWaypoint if waypoint is available
      if (this.isSharedRideMode && this.currentSharedRide && this.currentWaypoint) {
        await this.completeCurrentWaypoint();
        this.overlay.hideLoader();
        return;
      }

      // For non-shared rides or when currentWaypoint is not set, update the primary request
      const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
      await updateDoc(requestRef, {
        status: 'started',
        pickedUpAt: new Date().toISOString()
      });

      // If in shared ride mode, also update the shared ride's first passenger
      if (this.isSharedRideMode && this.currentSharedRide) {
        const firstWaypointIndex = this.currentSharedRide.route.waypoints.findIndex(
          wp => wp.type === 'pickup' && !wp.completed
        );
        if (firstWaypointIndex !== -1) {
          await this.rideSharingService.completeWaypoint(
            this.currentSharedRide.sharedRideId,
            firstWaypointIndex
          );
        }
      }

      this.overlay.hideLoader();
    } catch (e) {
      this.overlay.hideLoader();
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async DropOff() {
    try {
      this.overlay.showLoader('Dropping Off..');

      // In shared ride mode, use completeCurrentWaypoint if waypoint is available
      if (this.isSharedRideMode && this.currentSharedRide && this.currentWaypoint) {
        await this.completeCurrentWaypoint();
        this.overlay.hideLoader();
        return;
      }

      // For non-shared rides or when currentWaypoint is not set, update the primary request
      const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
      await updateDoc(requestRef, {
        status: 'done',
        droppedOffAt: new Date().toISOString()
      });

      // If in shared ride mode, also complete the shared ride's dropoff waypoint
      if (this.isSharedRideMode && this.currentSharedRide) {
        const dropoffWaypointIndex = this.currentSharedRide.route.waypoints.findIndex(
          wp => wp.type === 'dropoff' && !wp.completed
        );
        if (dropoffWaypointIndex !== -1) {
          await this.rideSharingService.completeWaypoint(
            this.currentSharedRide.sharedRideId,
            dropoffWaypointIndex
          );
        }
      }

      this.overlay.hideLoader();
    } catch (e) {
      this.overlay.hideLoader();
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async Navigate() {
    // Implementation for navigation
  }

  async fetchOnlineState() {
    try {
      console.log("Fetching online state...");
      const onlineState = await this.database.getOnlineState();
      console.log('Online state fetched from database:', onlineState); // Log the fetched state
      this.currentState = onlineState;
      console.log('Current state updated to:', this.currentState);
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error fetching online state:', e);
      this.overlay.showAlert('Error', 'Failed to fetch online state.');
    }
  }





  async SwitchOn() {
    try {
      this.approve = true;
      console.log('Attempting to go online...');

      let isApproved = this.driverData?.isApproved;

      //if (isApproved === undefined) {
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        const driverDocRef = doc(this.firestore, 'Drivers', currentUser.uid);
        const driverDoc = await getDoc(driverDocRef);
        isApproved = driverDoc.data()?.isApproved ?? false;
      }
      //}
      if (isApproved === false) {
        console.log('Driver approval pending.');
        await this.overlay.showAlert('Pending Approval', 'Approval is being process to activate account');
        return;
      }

      await this.database.updateOnlineState(true);
      await this.fetchOnlineState();
      console.log('Successfully went online.');
    } catch (e) {
      console.error('Error in SwitchOn:', e);
      this.overlay.showAlert('Error', 'Failed to go online.');
    } finally {
      this.approve = false;
      this.cdr.detectChanges();
    }
  }

  async SwitchOff() {
    try {
      this.approve = true;
      console.log('Attempting to go offline...');
      await this.database.updateOnlineState(false);
      await this.fetchOnlineState(); // Fetch the current state from the database
      console.log('Successfully went offline.');
    } catch (e) {
      console.error('Error in SwitchOff:', e);
      this.overlay.showAlert('Error', 'Failed to go offline.');
    } finally {
      this.approve = false;
      this.cdr.detectChanges();
    }
  }


  private async clearPrevMarkers() {
    try {

      // Clear animated marker
      if (this.animatedMarker) {
        await this.clearMarker(this.animatedMarker);
        this.animatedMarker = null;
      }

      if (this.routeUpdateSubscription) {
        this.routeUpdateSubscription.unsubscribe();
      }
      // Clear other markers
      if (this.rider_marker) {
        await this.clearMarker(this.rider_marker);
        this.rider_marker = null;
      }

      // Clear other markers
      if (this.driver_marker) {
        await this.clearMarker(this.driver_marker);
        this.driver_marker = null;
      }

      // Clear other markers
      if (this.destinationMarker) {
        await this.clearMarker(this.destinationMarker);
        this.destinationMarker = null;
      }

      // Clear other markers
      if (this.driver_marker1) {
        await this.clearMarker(this.driver_marker1);
        this.driver_marker1 = null;
      }

      // Clear other markers
      if (this.destinationMarker1) {
        await this.clearMarker(this.destinationMarker1);
        this.destinationMarker1 = null;
      }

      // Clear other markers
      if (this.marker1) {
        await this.clearMarker(this.marker1);
        this.marker1 = null;
      }

      if (this.marker2) {
        await this.clearMarker(this.marker2);
        this.marker2 = null;
      }



    } catch (e) {
      console.error('Error clearing markers:', e);
    }
  }


  private async clearMarker(marker) {
    if (marker && this.map && this.map.newMap) {
      try {
        // Verify marker is still valid before attempting removal
        if (typeof marker === 'string' || (typeof marker === 'object' && marker !== null)) {
          await this.map.newMap.removeMarker(marker);
          console.log("Marker was cleared!");
        } else {
          console.warn('Invalid marker object:', marker);
        }
      } catch (error) {
        console.error('Error clearing marker:', error);
        // Continue execution even if marker removal fails
      }
    } else {
      console.warn('Cannot clear marker: map or marker is null/undefined');
    }
  }



  async clearPolyline(polyline) {
    if (polyline && this.map && this.map.newMap) {
      try {
        await this.map.newMap.removePolylines(polyline);
        console.log('Polyline cleared:', polyline);
        this.newPoly = null;
      } catch (error) {
        console.error('Error clearing polyline:', error);
        // Continue execution even if polyline removal fails
      }
    } else {
      if (!polyline) {
        console.warn('No polyline to clear');
      } else {
        console.warn('Map not initialized, cannot clear polyline');
      }
    }
  }

  async ResetState() {
    try {
      // Unsubscribe from route updates if active
      if (this.routeUpdateSubscription) {
        this.routeUpdateSubscription.unsubscribe();
        this.routeUpdateSubscription = null;
        console.log('Route update subscription cleared');
      }

      // Clear previous markers
      await this.clearPrevMarkers();

      // Clear any existing polylines
      if (this.newPoly) {
        await this.clearPolyline(this.newPoly);
      }

      // Reset distance and duration variables
      this.distance = null;
      this.duration = null;
      this.driverToRiderDistance = null;
      this.driverToRiderDuration = null;
      this.riderToDestinationDistance = null;
      this.riderToDestinationDuration = null;

      const availableHeight = 1024;

      if (this.map && this.map.newMap) {
        this.map.newMap.enableTouch();
      }

      // // Start watching the user's position
      // this.startPollingPosition();

    } catch (e) {
      console.error('Error in ResetState:', e);
      throw new Error(e);
    }
  }




  async getDistanceandDirections() {
    try {
      if (!this.canStart) {


        console.log('LatLng:', this.DriverLatLng);

        const origin1 = new google.maps.LatLng(this.DriverLatLng.lat, this.DriverLatLng.lng);
        const origin2 = new google.maps.LatLng(this.DestinationLatLng.lat, this.DestinationLatLng.lng);

        const request = {
          origin: origin1,
          destination: origin2,
          travelMode: google.maps.TravelMode.DRIVING,
        };

        console.log('Directions request:', request);

        this.geocode.directions.route(request, async (response, status) => {
          console.log('Directions request status:', status);
          if (status === 'OK') {
            this.direction = response;
            this.canStart = false;
            this.distance = response.routes[0].legs[0].distance.value;

            console.log('Directions response:', response);
            console.log("Should Happen here.");

            this.distanceText = response.routes[0].legs[0].distance.text;
            this.durationText = response.routes[0].legs[0].duration.text;

            console.log('distanceText:', this.distanceText);
            console.log('durationText:', this.durationText);

            this.bounds = response.routes[0].bounds;

            await this.createAndAddMarkers(this.DriverLatLng, this.DestinationLatLng);
          } else {
            this.overlay.showAlert('Error', `Failed to get directions: ${status}`);
            this.canStart = false; // Reset canStart in case of error
          }
        });
        this.canStart = true;
      }
    } catch (e) {
      console.error('Error in getDistanceandDirections:', e);
      this.overlay.showAlert('Error', JSON.stringify(e));
      this.canStart = false; // Reset canStart in case of error
    }
  }

  async ReturnHome() {
    try {
      this.canStart = false;
      this.distanceText = null;
      this.durationText = null;
      this.riderInfo = null;
      this.driverToRiderDistance = null;
      this.driverToRiderDuration = null;
      this.riderToDestinationDistance = null;
      this.riderToDestinationDuration = null;
      this.canShowButton = false;

      // Clear countdown state completely
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
      this.countdownStarted = false;
      this.rideLostShown = false;

      // Reset ride acceptance state to allow new ride requests
      this.acceptedState = false;
      this.lastHandledState = null;

      // Unsubscribe from countdown watcher
      if (this.countdownWatcher) {
        this.countdownWatcher();
        this.countdownWatcher = null;
      }

      // Clear request listener
      if (this.driverRequestUnsubscribe) {
        this.driverRequestUnsubscribe();
        this.driverRequestUnsubscribe = null;
      }

      await this.ResetState();
      this.EnterBookingStage();

      if (this.map && this.map.newMap && this.LatLng) {
        // Re-enable current location tracking
        await this.map.newMap.enableCurrentLocation(true);

        await this.map.newMap.setCamera({
          animate: true,
          animationDuration: 500,
          zoom: 15,
          coordinate: this.LatLng,
        });
      }

      // Re-enable touch on map
      if (this.map && this.map.newMap) {
        this.map.newMap.enableTouch();
      }

      // Update online state and re-subscribe to listeners
      await this.database.updateOnlineState(true);
      await this.fetchOnlineState();
      await this.handleDriverRequestSnapshot();
      this.removed = false;

      console.log('Successfully returned home - ready for next ride');
    } catch (e) {
      console.error('Error in ReturnHome:', e);
      this.overlay.showAlert('Error', 'Failed to return home');
    }
  }

  async presentCancelRideActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      header: await this.translate.get('HOME.CANCEL_RIDE.HEADER').toPromise(),
      buttons: [
        {
          text: await this.translate.get('HOME.CANCEL_RIDE.CHANGED_MIND').toPromise(),
          handler: () => {
            this.cancelRide('Changed my mind');
          }
        },
        {
          text: await this.translate.get('HOME.CANCEL_RIDE.TOOK_TOO_LONG').toPromise(),
          handler: () => {
            this.cancelRide('Driver took too long');
          }
        },
        {
          text: await this.translate.get('HOME.CANCEL_RIDE.FOUND_ANOTHER').toPromise(),
          handler: () => {
            this.cancelRide('Found another ride');
          }
        },
        {
          text: await this.translate.get('HOME.CANCEL_RIDE.OTHER').toPromise(),
          handler: () => {
            this.cancelRide('Other');
          }
        },
        {
          text: await this.translate.get('COMMON.CANCEL').toPromise(),
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async cancelRide(reason: string) {

    this.driverCleared = true;
    this.overlay.showLoader('Cancelling Ride..');
    const rideRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
    const rideSnapshot = await getDoc(rideRef);
    const rideData = rideSnapshot.data();
    await updateDoc(rideRef, {
      status: 'cancelled',
      cancellationReason: reason,
      canceledBy: 'driver'
    });
    // Create a new document in the cancelledRides collection
    const cancelledRideRef = doc(collection(this.firestore, 'CancelledRides'));
    await setDoc(cancelledRideRef, {
      ...rideData,
      status: 'cancelled',
      cancellationReason: reason,
      canceledBy: 'rider',
      cancelledAt: serverTimestamp(),
      originalRequestId: this.requestID
    });
    const toast = await this.toastController.create({
      message: 'Ride has been cancelled.',
      duration: 2000
    });
    this.overlay.hideLoader();
    this.ReturnHome();
    await toast.present();
  }

  async ClearRide() {
    try {
      this.acceptedState = false;
      this.countdownStarted = false;
      await this.ReturnHome();
    } catch (e) {
      console.error('Error in ClearRide:', e);
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async createAndAddMarkers(loc, des) {
    const markerSize = { width: 30, height: 30 };
    const iconAnchor = { x: 10, y: 0 }; // Center bottom of the icon

    try {
      this.map.newMap.disableTouch();

      // Add start marker
      this.marker1 = await this.map.newMap.addMarker({
        coordinate: loc,
        iconUrl: 'assets/icon/point.png',
        title: 'Start',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 1, y: 0 },
      });

      // Add destination marker
      this.marker2 = await this.map.newMap.addMarker({
        coordinate: des,
        iconUrl: 'assets/icon/flag.png',
        title: 'Destination',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 1, y: 0 },
      });

      // Calculate the center point between the start and destination
      const locs = [
        { geoCode: { latitude: loc.lat, longitude: loc.lng } },
        { geoCode: { latitude: des.lat, longitude: des.lng } },
      ];

      const center = this.map.calculateCenter(locs);

      // Calculate the bounds
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(new google.maps.LatLng(loc.lat, loc.lng));
      bounds.extend(new google.maps.LatLng(des.lat, des.lng));

      // Set map height before calculating zoom level
      const availableHeight = this.mapRef.nativeElement.offsetHeight;

      // Prepare map dimensions for calculating zoom level
      const mapDim = {
        height: availableHeight,
        width: this.mapRef.nativeElement.offsetWidth,
      };

      // Calculate zoom level
      const zoomLevel = this.map.getBoundsZoomLevel(bounds, mapDim);

      console.log('Start:', loc.lat, loc.lng);
      console.log('Destination:', des.lat, des.lng);

      // Adjust zoom level to ensure both markers are visible with padding
      // Reduce by 0.5-1 to add padding around markers
      const adjustedZoomLevel = Math.max(zoomLevel - 0.8, 10); // Min zoom of 10
      console.log('Calculated zoom:', zoomLevel, 'Adjusted zoom:', adjustedZoomLevel);

      await this.map.setCameraToLocation(
        { lat: center.latitude, lng: center.longitude },
        adjustedZoomLevel,
        this.map.calculateBearing(loc, des)
      );



      // Add polyline between the start and destination
      await this.addPolyline(loc, des);

    } catch (error) {
      console.error('Error adding markers and polyline:', error);
    }
  }


  // Interval in milliseconds for updating the route
  UPDATE_INTERVAL = 10000; // Update every 10 seconds

  async handleDriverToRider(driverLatLng, riderLatLng) {
    const markerSize = { width: 30, height: 30 };
    const iconAnchor = { x: 10, y: 0 }; // Center bottom of the icon
    let stageTransitioned = false;

    try {
      // Add driver marker at the starting position
      const driverMarker = await this.map.newMap.addMarker({
        coordinate: driverLatLng,
        iconUrl: 'assets/icon/car.png',
        title: 'Driver',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 2, y: 0 },
      });
      this.driver_marker = driverMarker;

      // Add rider marker at the destination position
      const riderMarker = await this.map.newMap.addMarker({
        coordinate: riderLatLng,
        iconUrl: this.database.user.photoURL, // Change this to your rider icon URL
        title: 'Rider',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 2, y: 0 },
      });
      this.rider_marker = riderMarker;

      // Function to update route, duration, and distance
      const updateRoute = async () => {
        // Skip initial guard until we've transitioned into tracking
        if (!this.trackingStage && stageTransitioned) {
          console.log('No longer in tracking stage, stopping route updates');
          if (this.routeUpdateSubscription) {
            this.routeUpdateSubscription.unsubscribe();
          }
          return;
        }

        // Use current driver location for dynamic updates
        const currentDriverLocation = this.DriverLatLng || driverLatLng;

        const request = {
          origin: currentDriverLocation,
          destination: riderLatLng,
          travelMode: google.maps.TravelMode.DRIVING,
        };

        this.geocode.directions.route(request, async (response, status) => {
          if (status === 'OK') {
            const path = response.routes[0].overview_path.map(latlng => ({
              lat: latlng.lat(),
              lng: latlng.lng()
            }));

            // Update these specific variables for driver-to-rider stage
            this.driverToRiderDuration = response.routes[0].legs[0].duration.text;
            this.driverToRiderDistance = response.routes[0].legs[0].distance.text;
            const distanceInMeters = response.routes[0].legs[0].distance.value;

            // Also update the general variables for backward compatibility
            this.duration = this.driverToRiderDuration;
            this.distance = this.driverToRiderDistance;

            console.log(`Driving to Rider - Duration: ${this.driverToRiderDuration}, Distance: ${this.driverToRiderDistance}`);

            // Enable pickup button when driver is within 100 meters of rider
            if (distanceInMeters <= 100) {
              this.canShowButton = true;
              console.log('Driver is close to rider - enabling pickup button');
            } else {
              this.canShowButton = false;
            }

            // Use current driver location for centering
            const currentDriverLocation = this.DriverLatLng || driverLatLng;
            const locs = [
              { geoCode: { latitude: currentDriverLocation.lat, longitude: currentDriverLocation.lng } },
              { geoCode: { latitude: riderLatLng.lat, longitude: riderLatLng.lng } },
            ];

            const center = this.map.calculateCenter(locs);

            const bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(currentDriverLocation.lat, currentDriverLocation.lng));
            bounds.extend(new google.maps.LatLng(riderLatLng.lat, riderLatLng.lng));


            const availableHeight = this.mapRef.nativeElement.offsetHeight;

            // Prepare map dimensions for calculating zoom level
            const mapDim = {
              height: availableHeight,
              width: this.mapRef.nativeElement.offsetWidth,
            };

            // Calculate zoom level
            const zoomLevel = this.map.getBoundsZoomLevel(bounds, mapDim);

            // Adjust zoom level to ensure visibility with padding
            const adjustedZoomLevel = Math.max(zoomLevel - 0.8, 11); // Min zoom of 11 for closer view
            console.log('Driver to Rider - Calculated zoom:', zoomLevel, 'Adjusted:', adjustedZoomLevel);

            await this.map.setCameraToLocation(
              { lat: center.latitude, lng: center.longitude },
              adjustedZoomLevel,
              this.map.calculateBearing(currentDriverLocation, riderLatLng)
            );


            // Update polyline for the route
            if (this.newPoly) {
              await this.clearPolyline(this.newPoly);
            }
            await this.addPolyline(currentDriverLocation, riderLatLng);

            // Call EnterTrackingStage after determining duration and distance
            if (!stageTransitioned) {
              this.EnterTrackingStage();
              stageTransitioned = true;
              this.overlay.hideLoader();
            }

            // Animate the driver marker along the path to the rider
            await this.animateMarker(this.driver_marker, path, 'assets/icon/car.png');
          } else {
            console.error('Direction ERROR:', response);
            this.overlay.showAlert('Direction ERROR', JSON.stringify(response));
          }
        });
      };

      // Call updateRoute immediately to show initial route
      await updateRoute();

      // Start updating the route periodically
      const routeUpdate$ = interval(this.UPDATE_INTERVAL).pipe(
        switchMap(() => updateRoute())
      );

      // Subscribe to the interval observable to start updating
      this.routeUpdateSubscription = routeUpdate$.subscribe();

      // Cleanup subscription when the component or context is destroyed
      // Call routeUpdateSubscription.unsubscribe() when needed

    } catch (error) {
      console.error('Error handling driver to rider:', error);
    }
  }

  async handleRiderToDestination(driverLatLng, destinationLatLng) {
    const markerSize = { width: 30, height: 30 };
    const iconAnchor = { x: 10, y: 0 }; // Center bottom of the icon
    let stageTransitioned = false;

    try {
      // Update driver marker to driver's current position
      const driverMarker = await this.map.newMap.addMarker({
        coordinate: driverLatLng,
        iconUrl: 'assets/icon/car.png',
        title: 'Driver',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 0, y: 0 },
      });
      this.driver_marker1 = driverMarker;

      // Add destination marker
      const destinationMarker = await this.map.newMap.addMarker({
        coordinate: destinationLatLng,
        iconUrl: 'assets/icon/flag.png',
        title: 'Destination',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 0, y: 0 },
      });
      this.destinationMarker1 = destinationMarker;

      // Function to update route, duration, and distance
      const updateRoute = async () => {
        // Skip initial guard until navigation stage is active
        if (!this.drivingToDestinationStage && stageTransitioned) {
          console.log('No longer in driving to destination stage, stopping route updates');
          if (this.routeUpdateSubscription) {
            this.routeUpdateSubscription.unsubscribe();
          }
          return;
        }

        // Use current driver location for dynamic updates
        const currentDriverLocation = this.DriverLatLng || driverLatLng;

        const request = {
          origin: currentDriverLocation,
          destination: destinationLatLng,
          travelMode: google.maps.TravelMode.DRIVING,
        };

        this.geocode.directions.route(request, async (response, status) => {
          if (status === 'OK') {
            const path = response.routes[0].overview_path.map(latlng => ({
              lat: latlng.lat(),
              lng: latlng.lng()
            }));

            // Update these specific variables for rider-to-destination stage
            this.riderToDestinationDuration = response.routes[0].legs[0].duration.text;
            this.riderToDestinationDistance = response.routes[0].legs[0].distance.text;

            // Also update the general variables for backward compatibility
            this.duration = this.riderToDestinationDuration;
            this.distance = this.riderToDestinationDistance;

            console.log(`Driving to Destination - Duration: ${this.riderToDestinationDuration}, Distance: ${this.riderToDestinationDistance}`);

            // Use current driver location for centering
            const currentDriverLocation = this.DriverLatLng || driverLatLng;
            const locs = [
              { geoCode: { latitude: currentDriverLocation.lat, longitude: currentDriverLocation.lng } },
              { geoCode: { latitude: destinationLatLng.lat, longitude: destinationLatLng.lng } },
            ];

            const center = this.map.calculateCenter(locs);

            const bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(currentDriverLocation.lat, currentDriverLocation.lng));
            bounds.extend(new google.maps.LatLng(destinationLatLng.lat, destinationLatLng.lng));

            const availableHeight = this.mapRef.nativeElement.offsetHeight;

            // Prepare map dimensions for calculating zoom level
            const mapDim = {
              height: availableHeight,
              width: this.mapRef.nativeElement.offsetWidth,
            };

            // Calculate zoom level
            const zoomLevel = this.map.getBoundsZoomLevel(bounds, mapDim);

            // Adjust zoom level to ensure visibility with padding
            const adjustedZoomLevel = Math.max(zoomLevel - 0.8, 11); // Min zoom of 11
            console.log('Rider to Destination - Calculated zoom:', zoomLevel, 'Adjusted:', adjustedZoomLevel);

            await this.map.setCameraToLocation(
              { lat: center.latitude, lng: center.longitude },
              adjustedZoomLevel,
              this.map.calculateBearing(currentDriverLocation, destinationLatLng)
            );



            // Update polyline for the route
            if (this.newPoly) {
              await this.clearPolyline(this.newPoly);
            }
            await this.addPolyline(currentDriverLocation, destinationLatLng);

            // Call EnterDrivingToDestinationStage after determining duration and distance
            if (!stageTransitioned) {
              this.EnterDrivingToDestinationStage();
              stageTransitioned = true;
              this.overlay.hideLoader();
            }

            // Animate the driver marker along the path to the destination
            await this.animateMarker(this.driver_marker, path, 'assets/icon/car.png');
          } else {
            console.error('Direction ERROR:', response);
            this.overlay.showAlert('Direction ERROR', JSON.stringify(response));
          }
        });
      };

      // Call updateRoute immediately to show initial route
      await updateRoute();

      // Start updating the route periodically
      const routeUpdate$ = interval(this.UPDATE_INTERVAL).pipe(
        switchMap(() => updateRoute())
      );

      // Subscribe to the interval observable to start updating
      this.routeUpdateSubscription = routeUpdate$.subscribe();


    } catch (error) {
      console.error('Error handling rider to destination:', error);
    }
  }



  async animateMarker(marker, path, iconUrl) {
    const markerSize = { width: 50, height: 50 };
    const iconAnchor = { x: 25, y: 50 }; // Center bottom of the icon

    const moveMarker = async (i) => {
      if (i >= path.length || !this.map || !this.map.newMap) return;

      // Safely remove old marker before adding new one
      if (marker) {
        try {
          await this.map.newMap.removeMarker(marker);
        } catch (error) {
          console.warn('Error removing marker during animation:', error);
        }
      }

      const coordinate = path[i] instanceof google.maps.LatLng ?
        { lat: path[i].lat(), lng: path[i].lng() } :
        { lat: path[i].lat, lng: path[i].lng };

      try {
        marker = await this.map.newMap.addMarker({
          coordinate: coordinate,
          iconUrl: iconUrl,
          title: 'Moving Marker',
          iconSize: markerSize,
          iconAnchor: iconAnchor,
          iconOrigin: { x: 0, y: 0 },
        });

        requestAnimationFrame(() => moveMarker(i + 1));
      } catch (error) {
        console.error('Error adding marker during animation:', error);
      }
    };

    await moveMarker(0);

    // Store the last position of the animated marker
    this.animatedMarker = marker;
  }



  async addPolyline(loc: { lat: number, lng: number }, des: { lat: number, lng: number }): Promise<(LatLng | LatLngLiteral)[]> {
    try {
      const path = await this.map.getRoutePath(loc, des);
      const polylineColor = "#007bff";
      const polylines: Polyline[] = [
        {
          path,
          strokeColor: polylineColor,
          strokeWeight: 8,
          geodesic: true
        }
      ];

      this.newPoly = await this.map.newMap.addPolylines(polylines);
      return path as (LatLng | LatLngLiteral)[];
    } catch (e) {
      console.log('Error Adding Polyline: ', e);
      return [];
    }
  }


  EnterBookingStage() {
    this.bookingStage = true;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterConfirmStage() {
    this.bookingStage = false;
    this.confirmStage = true;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterSearchingStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterNoDriverStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterTrackingStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = true;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterDrivingToDestinationStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = true;
  }

  async changeLanguage(language: string) {
    this.translate.use(language);
    // Optionally save the language preference
    localStorage.setItem('preferred_language', language);
  }

  private async showLocationPermissionAlert() {
    const alert = await this.alertController.create({
      header: 'Location Access Required',
      message: 'This app needs access to your location to connect you with nearby riders. Please enable location access to continue.',
      buttons: ['OK']
    });
    await alert.present();
  }

  private async handleLocationPermissionDenied() {
    if (!this.platform.is('hybrid')) {
      await this.showWebLocationRequiredAlert();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Location Access Denied',
      message: 'This app requires location access to function. Please enable location access in your device settings to continue.',
      buttons: [
        {
          text: 'Open Settings',
          handler: () => {
            // Open device settings if possible
            if (this.platform.is('ios')) {
              window.open('app-settings:');
            } else if (this.platform.is('android')) {
              window.open('package:settings');
            }
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            // Optionally redirect to a different page or show alternative content
            console.log('User cancelled location permission');
          }
        }
      ]
    });
    await alert.present();

    // Start polling for permissions on native platforms
    this.startNativePermissionPolling();
  }

  private startNativePermissionPolling() {
    if ((window as any)._nativeGeoPolling) clearInterval((window as any)._nativeGeoPolling);
    (window as any)._nativeGeoPolling = setInterval(async () => {
      const permissionStatus = await Geolocation.checkPermissions();
      if (permissionStatus.location === 'granted') {
        console.log('Native location permission granted via polling');
        clearInterval((window as any)._nativeGeoPolling);
        // We can't easily re-run ngAfterViewInit but we can try to re-init geolocation
        // For simplicity, we suggest a reload or try to re-init map if possible.
        // In Driver, ngAfterViewInit is doing a lot of setup.
        this.retryLocationInitialization();
      }
    }, 2000);
  }

  async retryLocationInitialization() {
    console.log('Retrying Driver geolocation initialization...');
    this.overlay.showLoader('Updating location...');

    let coordinates;
    try {
      if (!this.platform.is('hybrid') && navigator.geolocation) {
        coordinates = await new Promise<any>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                heading: pos.coords.heading,
                speed: pos.coords.speed
              },
              timestamp: pos.timestamp
            }),
            reject,
            { timeout: 10000, enableHighAccuracy: true }
          );
        });
      } else {
        coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      }

      this.overlay.hideLoader();
      this.overlay.showToast('Location updated successfully!');

      this.coordinates = coordinates;
      this.LatLng = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      };

      // Update map
      if (!this.mapy) {
        await this.map.createMap(this.mapRef.nativeElement, coordinates);
        this.ngZone.run(() => {
          this.mapy = true;
          this.actualLocation = this.map.actualLocation;
          this.locationAddress = this.map.locationAddress;
        });
      } else {
        await this.map.newMap.setCamera({
          coordinate: this.LatLng,
          zoom: 15,
          animate: true
        });
      }

      // Update backend
      await this.database.updateDriverLocation(this.LatLng);

    } catch (e) {
      console.error('Retry failed:', e);
      this.overlay.hideLoader();
      this.overlay.showToast('Failed to acquire location. Please try again.');
    }
  }

  private async showWebLocationRequiredAlert() {
    const alert = await this.alertController.create({
      header: 'Location Required',
      message: 'Location access is required. If you have denied it, please enable it in your browser site settings and click "Retry".',
      buttons: [
        {
          text: 'Retry',
          handler: () => {
            this.retryLocationInitialization();
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
    this.startWebPermissionWatcher();
  }

  private async startWebPermissionWatcher() {
    if (!this.platform.is('hybrid') && navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (!(window as any)._geoWatcherActive) {
          result.addEventListener('change', () => {
            console.log('Web geolocation permission status changed to:', result.state);
            if (result.state === 'granted') {
              this.retryLocationInitialization();
            }
          });
          (window as any)._geoWatcherActive = true;
        }
      } catch (e) {
        console.error('Error starting web permission watcher:', e);
      }
    }
  }

  // Optional: Create a reusable loading message service
  private getLoadingMessage(state: string): string {
    const messages = {
      confirmed: 'Navigating to rider...',
      started: 'Starting trip...',
      done: 'Completing trip...',
      // Add more states as needed
    };
    return messages[state] || 'Loading...';
  }
}
