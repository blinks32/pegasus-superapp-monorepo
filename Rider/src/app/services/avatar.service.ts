import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { collection, collectionData, CollectionReference, doc, docData, DocumentData, endAt, Firestore, getDocs, orderBy, query, setDoc, startAt, updateDoc, onSnapshot, deleteDoc, serverTimestamp, addDoc, getDoc, where, writeBatch } from '@angular/fire/firestore';
import {
  getDownloadURL,
  ref,
  Storage,
  uploadString,
} from '@angular/fire/storage';
import { Photo } from '@capacitor/camera';
import { geohashForLocation, geohashQueryBounds } from 'geofire-common';
import { BehaviorSubject, Observable } from 'rxjs';
import { Card } from '../interfaces/card';
import { Drivers } from '../interfaces/drivers';
import { Rider } from '../interfaces/rider';
import { AuthService } from './auth.service';
import { v4 as uuidv4 } from 'uuid';


@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  authStateSubscription: any;
  isRandom: boolean;
  bookRide(data: any) {
    throw new Error('Method not implemented.');
  }

  directory: any;
  userUID: string;
  userName: string;
  userEmail: string;
  profile: DocumentData;
  pathM: string;
  countryCode: any;
  user: import("@angular/fire/auth").User;
  public driverCollection: CollectionReference<DocumentData>;
  private driversSubject = new BehaviorSubject<Drivers[]>([]);
  drivers$ = this.driversSubject.asObservable();
  public activeListeners: { [key: string]: () => void } = {};
  requestID: string;
  constructor(
    private auth: Auth,
    public firestore: Firestore,
    private storage: Storage,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.user = user;

        this.driverCollection = collection(this.firestore, 'Drivers');

        this.http.get("https://ipapi.co/json/").subscribe({
          next: (res: any) => {
            console.log('Country detection response:', res);
            this.countryCode = res.country_code || 'NG';
          },
          error: (error) => {
            console.warn('Failed to detect country, using default:', error);
            this.countryCode = 'NG'; // Default fallback
          }
        })

        // Add a small delay for Android to ensure Firebase is fully initialized
        setTimeout(async () => {
          try {
            await this.loadUserProfile();
          } catch (error) {
            console.error('Failed to load user profile:', error);
            // Create a minimal offline profile to prevent app from breaking
            this.profile = {
              Rider_id: this.user.uid,
              Rider_name: this.user.displayName || 'Unknown',
              Rider_phone: this.user.phoneNumber || 'Unknown',
              Rider_email: this.user.email || 'Unknown',
              Rider_rating: 0,
              createdAt: new Date().toISOString(),
              offline: true
            };
            console.log('Using offline profile due to error:', this.profile);
          }
        }, 2000); // Increased delay for Android


      }

    })

  }

  private async checkFirestoreConnectivity(): Promise<boolean> {
    try {
      console.log('Checking Firestore connectivity...');
      // Try to read a simple document to test connectivity
      const testDoc = await getDoc(doc(this.firestore, '_test_', 'connectivity'));
      console.log('Firestore connectivity check completed');
      return true;
    } catch (error) {
      console.warn('Firestore connectivity issue detected:', error);
      // Don't throw error, just log it and continue
      return false;
    }
  }

  // Android-specific wrapper for Firestore operations with better error handling
  private async executeFirestoreOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`${operationName} - Attempt ${attempt}`);
        const result = await operation();
        console.log(`${operationName} - Success on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`${operationName} - Failed on attempt ${attempt}:`, error);

        // Don't retry on certain errors
        if (error.code === 'permission-denied' || error.code === 'not-found') {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }


  async loadUserProfile() {
    try {
      console.log('Loading user profile for:', this.user.uid);

      const docRef = doc(this.firestore, 'Riders', this.user.uid);

      // Use the Android-optimized wrapper for Firestore operations
      const profileDoc = await this.executeFirestoreOperation(
        () => getDoc(docRef),
        'Load User Profile'
      );

      if (profileDoc && profileDoc.exists()) {
        this.profile = profileDoc.data();
        console.log('Profile loaded successfully:', this.profile);
      } else {
        console.log('Profile does not exist, creating default profile');
        // Create a default profile if it doesn't exist
        const defaultProfile = {
          Rider_id: this.user.uid,
          Rider_name: this.user.displayName || 'Unknown',
          Rider_phone: this.user.phoneNumber || 'Unknown',
          Rider_email: this.user.email || 'Unknown',
          Rider_rating: 0,
          createdAt: new Date().toISOString()
        };

        // Use the wrapper for creating the profile too
        await this.executeFirestoreOperation(
          () => setDoc(docRef, defaultProfile, { merge: true }),
          'Create Default Profile'
        );

        this.profile = defaultProfile;
        console.log('Default profile created:', this.profile);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);

      // Android-specific error handling
      if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
        // Create offline profile for Android when Firestore is unavailable
        console.log('Creating offline profile due to Firestore unavailability');
        this.profile = {
          Rider_id: this.user.uid,
          Rider_name: this.user.displayName || 'Unknown',
          Rider_phone: this.user.phoneNumber || 'Unknown',
          Rider_email: this.user.email || 'Unknown',
          Rider_rating: 0,
          createdAt: new Date().toISOString(),
          offline: true
        };
        return; // Don't throw error, continue with offline profile
      } else if (error.code === 'permission-denied') {
        const diagnosticMsg = 'Permission denied. This usually means your Firestore Security Rules are blocking access. Please ensure your Firebase Console has the correct rules configured for the "Riders" collection.';
        console.error(diagnosticMsg);
        throw new Error(diagnosticMsg);
      } else {
        throw new Error(`Failed to load profile: ${error.message}`);
      }
    }
  }


  getCards(): Observable<Card[]> {
    const userDocRef = collection(this.firestore, `Riders/${this.auth.currentUser.uid}/Cards`);
    return collectionData(userDocRef) as Observable<Card[]>;
  }




  async getUserType(uid: string): Promise<string | null> {
    const userDocRef = doc(this.firestore, `Drivers/${uid}`);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return 'driver';
    }
    return null;
  }

  async checkRiderProfile(uid: string): Promise<boolean> {
    try {
      console.log('Checking rider profile for uid:', uid);
      const riderDocRef = doc(this.firestore, `Riders/${uid}`);
      const riderDoc = await getDoc(riderDocRef);

      if (!riderDoc.exists()) {
        console.log('Rider document does not exist for uid:', uid);
        return false;
      }

      const data = riderDoc.data();
      // Check if essential profile fields exist (name and email are required for a complete profile)
      const hasRequiredFields = !!(data?.Rider_name && data?.Rider_email);
      console.log('Rider profile check - hasRequiredFields:', hasRequiredFields, 'data:', {
        Rider_name: data?.Rider_name,
        Rider_email: data?.Rider_email,
        Rider_id: data?.Rider_id
      });

      return hasRequiredFields;
    } catch (error) {
      console.error('Error checking rider profile:', error);
      return false;
    }
  }


  async RequestRideWithRiderDetails(requestDetails) {
    // First, validate all input data
    if (!requestDetails || !requestDetails.driverId || !requestDetails.latLng || !requestDetails.dLatLng) {
      console.error('Invalid request details:', requestDetails);
      throw new Error('Invalid request details');
    }

    // Ensure profile is loaded
    if (!this.profile) {
      try {
        await this.loadUserProfile();
        if (!this.profile) {
          console.error('Failed to load user profile');
          throw new Error('Profile not initialized');
        }
      } catch (profileError) {
        console.error('Error loading profile:', profileError);
        throw new Error(`Profile initialization failed: ${profileError.message}`);
      }
    }

    try {
      // Check if user is authenticated
      if (!this.user || !this.user.uid) {
        throw new Error('User not authenticated');
      }

      // Validate driver exists
      const driverDocRef = doc(this.firestore, 'Drivers', requestDetails.driverId);
      const driverDocSnap = await getDoc(driverDocRef);

      if (!driverDocSnap.exists()) {
        console.error('Driver does not exist:', requestDetails.driverId);
        throw new Error('Driver does not exist');
      }

      const driverData = driverDocSnap.data();
      // Validate driver data
      if (!driverData.Driver_id || !driverData.Driver_name) {
        console.error('Invalid driver data:', driverData);
        throw new Error('Invalid driver data');
      }

      // Create a new request document reference
      const requestRef = doc(collection(this.firestore, 'Request'));

      // Create the request data object with all required fields
      const loc = {
        Loc_lat: requestDetails.latLng.lat,
        Loc_lng: requestDetails.latLng.lng,
        Rider_id: this.user.uid,
        Rider_name: this.user.displayName || 'Unknown User',
        Rider_phone: this.user.phoneNumber || '',
        Rider_imgUrl: this.user.photoURL || '',
        Rider_rating: this.profile.Rider_rating || 0,
        Des_lat: requestDetails.dLatLng.lat,
        Des_lng: requestDetails.dLatLng.lng,
        Rider_Location: requestDetails.locationAddress || 'Unknown location',
        Rider_Destination: requestDetails.destinationAddress || 'Unknown destination',
        Rider_email: this.user.email || '',
        countDown: 20,
        cancel: false,
        price: requestDetails.price || 0,
        cash: requestDetails.cash || true,
        status: 'pending',
        driverDetails: {
          Driver_id: driverData.Driver_id,
          Driver_name: driverData.Driver_name,
          Driver_phone: driverData.Driver_phone || '',
          Driver_imgUrl: driverData.Driver_imgUrl || '',
          Driver_rating: driverData.Driver_rating || 0,
          Driver_car: driverData.Driver_car || '',
          Driver_cartype: driverData.Driver_cartype || '',
          Driver_plate: driverData.Driver_plate || '',
        },
        requestId: requestRef.id,
        driverId: requestDetails.driverId,
        createdAt: serverTimestamp(), // Add timestamp for better tracking
        // Shared ride fields
        sharedRideAccepted: requestDetails.sharedRideAccepted || false,
        isSharedRide: requestDetails.isSharedRide || false,
        sharedRideId: requestDetails.sharedRideId || null,
        originalPrice: requestDetails.originalPrice || requestDetails.price || 0,
        discountedPrice: requestDetails.discountedPrice || requestDetails.price || 0,
        discountPercent: requestDetails.discountPercent || 0
      };

      console.log('Creating ride request with data:', {
        requestId: requestRef.id,
        driverId: requestDetails.driverId,
        riderId: this.user.uid,
        sharedRideAccepted: loc.sharedRideAccepted
      });

      // Create a batch for atomic operations
      const batch = writeBatch(this.firestore);

      try {
        // Update driver document
        batch.update(driverDocRef, {
          onlineState: false,
          currentRequestId: requestRef.id
        });

        // Set request document
        batch.set(requestRef, loc);

        // Add initial message to messages subcollection
        const messagesRef = collection(requestRef, 'messages');
        const initialMessage = {
          msg: 'Ride request initiated',
          from: 'system',
          createdAt: serverTimestamp(),
          myMsg: false,
          fromName: 'System'
        };

        // Use a unique ID for the message document to avoid conflicts
        const messageDocRef = doc(messagesRef);
        batch.set(messageDocRef, initialMessage);

        // Commit all changes as a single atomic operation
        await batch.commit();

        console.log('Ride request created successfully:', requestRef.id);
        return requestRef.id;
      } catch (batchError) {
        console.error('Error during batch commit:', batchError);
        // Try to roll back by updating driver status back to online
        try {
          await updateDoc(driverDocRef, { onlineState: true, currentRequestId: null });
        } catch (rollbackError) {
          console.error('Failed to rollback driver status:', rollbackError);
        }
        throw new Error(`Failed to create ride request: ${batchError.message}`);
      }
    } catch (error) {
      console.error(`Error in RequestRideWithRiderDetails:`, error);
      // Ensure we throw an error with a clear message
      if (error.message) {
        throw error; // Re-throw if it already has a message
      } else {
        throw new Error(`Failed to request ride: ${error}`);
      }
    }
  }




  async RestartRequestSinceReject(ID) {
    const userDocRef = doc(this.firestore, 'Request', ID)
    await updateDoc(userDocRef, { cancel: false });
  }

  //delete the driver that has a request sent to him.
  async deleDriverFromRequest(ID) {
    await deleteDoc(doc(this.firestore, "Request", ID))
  }

  async cancelRide(ID) {
    const userDocRef = doc(this.firestore, 'Request', ID)
    await updateDoc(userDocRef, { status: true });
  }

  //Push driver info into the request database
  async PushDriverToRequest(Driver) {
    try {
      const loc: Drivers = {
        geohash: Driver.geohash,
        Driver_lat: Driver.Driver_lat,
        Driver_lng: Driver.Driver_lng,
        Driver_id: Driver.Driver_id,
        Driver_name: Driver.Driver_name,
        Driver_car: Driver.Driver_car,
        Driver_imgUrl: Driver.Driver_imgUrl,
        Driver_rating: Driver.Driver_rating,
        distance: 0,
        duration: 0,
        seats: Driver.seats,
        start: false,
        stop: Driver.stop,
        intransit: Driver.intransit,
        cancel: Driver.cancel,
        Driver_cartype: Driver.Driver_cartype,
        Driver_plate: Driver.Driver_plate,
        time: '',
        onlineState: Driver.onlineState
      };
      await updateDoc(doc(this.firestore, "Request", Driver.Driver_id), { ...loc });
    } catch (e) {
      throw new Error(e);

    }

    console.log('done')
  }

  async getPriceEstimate(distance: number): Promise<number> {
    try {
      // Convert distance from meters to kilometers
      const distanceInKm = distance / 1000;

      // Basic initial estimate based on distance only
      const ratePerKm = 1.5; // Base rate per kilometer
      let estimatedPrice = distanceInKm * ratePerKm;

      // Apply minimum fare if applicable
      const minimumFare = 5; // Minimum fare amount
      if (estimatedPrice < minimumFare) {
        estimatedPrice = minimumFare;
      }

      // Round to 2 decimal places
      return Math.round(estimatedPrice * 100) / 100;
    } catch (error) {
      console.error('Error calculating price estimate:', error);
      throw error;
    }
  }

  // Add a new method for final fare calculation
  async calculateFinalFare(distance: number, duration: number): Promise<number> {
    try {
      // Convert duration to minutes if it's in milliseconds or seconds
      let durationInMinutes = duration;

      // If duration is in milliseconds (common format from timestamps)
      if (duration > 1000) {
        durationInMinutes = Math.round(duration / 60000); // Convert ms to minutes
      }

      // Rate constants
      const ratePerKm = 1.0;       // $1 per kilometer
      const ratePerMinute = 0.1;   // $0.1 per minute
      const minimumFare = 5.0;     // $5 minimum fare

      // Calculate fare components
      const distanceCharge = distance * ratePerKm;
      const timeCharge = durationInMinutes * ratePerMinute;

      // Calculate total fare
      let totalFare = distanceCharge + timeCharge;

      // Apply minimum fare if applicable
      if (distance < 5 || totalFare < minimumFare) {
        totalFare = minimumFare;
      }

      // Round to 2 decimal places for proper currency display
      return Math.round(totalFare * 100) / 100;
    } catch (error) {
      console.error('Error calculating final fare:', error);
      throw error;
    }
  }

  getDriverLocation(driverId: string): Promise<{ lat: number, lng: number } | null> {
    return new Promise((resolve, reject) => {
      const driverDocRef = doc(this.firestore, 'Drivers', driverId);
      onSnapshot(driverDocRef, (doc) => {
        const data = doc.data();
        if (data && data.Driver_lat) {
          const driverLocation = {
            lat: data.Driver_lat,
            lng: data.Driver_lng
          };
          resolve(driverLocation);
        } else {
          resolve(null);
        }
      }, (error) => {
        reject(error);
      });
    });
  }

  async updateLocation(coord: { lat: number, lng: number }): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, `Riders/${this.auth.currentUser.uid}`);

      // First, set the document with initial data
      await setDoc(userDocRef, {
        geohash: geohashForLocation([coord.lat, coord.lng]),
        Loc_lat: coord.lat,
        Loc_lng: coord.lng,
      }, { merge: true });  // Use merge: true to avoid overwriting existing data

      // Then, update the document
      await updateDoc(userDocRef, {
        geohash: geohashForLocation([coord.lat, coord.lng]),
        Loc_lat: coord.lat,
        Loc_lng: coord.lng,
      });

      return true;
    } catch (e) {
      console.error('Error updating rider location:', e);
      return false;
    }
  }


  async createHistory(Driver, requestId) {
    try {
      // Get current user ID for the rider
      const riderId = this.user?.uid || '';

      // Create a clean object with default values for all required fields
      const historyData = {
        driverId: Driver.Driver_id || '',
        riderId: riderId, // Add rider ID from the current user
        rideId: requestId || '',
        timestamp: serverTimestamp(),
        geohash: Driver.geohash || '',
        Driver_lat: Driver.Driver_lat || 0,
        Driver_lng: Driver.Driver_lng || 0,
        Loc_lat: Driver.Loc_lat || 0, // For rider pickup location
        Loc_lng: Driver.Loc_lng || 0,
        Des_lat: Driver.Des_lat || 0, // For destination
        Des_lng: Driver.Des_lng || 0,
        Rider_Location: Driver.Rider_Location || '',
        Rider_Destination: Driver.Rider_Destination || '',
        Driver_name: Driver.Driver_name || '',
        Driver_car: Driver.Driver_car || '',
        Driver_imgUrl: Driver.Driver_imgUrl || '',
        Driver_rating: Driver.Driver_rating || 0,
        distance: Driver.distance || 0,
        duration: Driver.duration || 0,
        distanceInKm: Driver.distanceInKm || 0,
        seats: Driver.seats || 0,
        start: true,
        stop: Driver.stop || false,
        intransit: Driver.intransit || false,
        cancel: Driver.cancel || false,
        Driver_cartype: Driver.Driver_cartype || '',
        Driver_plate: Driver.Driver_plate || '',
        price: Driver.price || 0,
        onlineState: Driver.onlineState || false
      };

      // Remove any remaining undefined values
      Object.keys(historyData).forEach(key => {
        if (historyData[key] === undefined) {
          historyData[key] = null; // Replace undefined with null (accepted by Firestore)
        }
      });

      console.log('Creating ride history with data:', historyData);

      const historyRef = doc(collection(this.firestore, 'RideHistory'));
      await setDoc(historyRef, historyData);

      console.log('Ride history created successfully with distance:', historyData.distance);
      return true;
    } catch (error) {
      console.error('Error creating ride history:', error);
      throw error;
    }
  }


  async UpdateCountDown(time, id) {
    try {
      const userDocRef = doc(this.firestore, "Request", id)
      await updateDoc(userDocRef, {
        countDown: time,
      });
      return true;
    } catch (e) {
      // alert(e)
      console.log(e);
      return null;
    }
  }


  async AddKnownPlace(place: any): Promise<boolean | null> {
    console.log(this.auth.currentUser.uid);
    console.log(place.full);
    try {
      const userDocRef = doc(this.firestore, 'Riders', `${this.auth.currentUser.uid}/KnownPlaces/${place.full}`);
      await setDoc(userDocRef, { place });
      return true;
    } catch (e) {
      console.log(e);
      return null;
    }
  }


  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      0.5 - Math.cos(dLat) / 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  async checkDriversWithin(center: [number, number], radiusInM: number): Promise<Drivers[]> {
    try {
      console.log("Center:", center);
      console.log("Radius in meters:", radiusInM);

      const bounds = geohashQueryBounds(center, radiusInM);
      const promises: Promise<Drivers[]>[] = bounds.map((b, index) => {
        const q = query(this.driverCollection, orderBy("geohash"), startAt(b[0]), endAt(b[1]));
        return new Promise<Drivers[]>((resolve, reject) => {
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const drivers = snapshot.docs.map((doc) => {
              const data = doc.data() as Drivers;
              console.log("Driver data from snapshot:", data);
              return data;
            });
            console.log("Query results for bounds", b, drivers);
            resolve(drivers);
            unsubscribe(); // Unsubscribe once data is fetched
            delete this.activeListeners[index];
          }, (error) => {
            console.error('Error in onSnapshot:', error);
            reject(error);
            unsubscribe(); // Unsubscribe in case of error
            delete this.activeListeners[index];
          });

          // Store the unsubscribe function to manage listeners
          this.activeListeners[index] = unsubscribe;
        });
      });
      const results = await Promise.all(promises);
      const allDrivers = results.reduce((acc, curr) => acc.concat(curr), []);
      console.log("All drivers from queries:", allDrivers);

      const matchingDrivers = allDrivers.filter((driver) => {
        if (!driver || !driver.Driver_lat || !driver.Driver_lng) {
          console.error(`Driver ${driver?.Driver_id || 'unknown'} has missing coordinates:`, driver);
          return false;
        }

        const distanceInKm = this.calculateDistance(center[0], center[1], driver.Driver_lat, driver.Driver_lng);
        const distanceInM = distanceInKm * 1000;
        console.log(`Driver ${driver.Driver_id} distance:`, distanceInM);

        if (distanceInM <= radiusInM) {
          driver.duration = distanceInM / (50 / 3.6); // duration in seconds, assuming 50 km/h speed
          return true;
        } else {
          return false;
        }
      });

      console.log("Matching drivers within radius:", matchingDrivers);
      return matchingDrivers;
    } catch (e) {
      console.error('Error in checkDriversWithin:', e);
      throw new Error(e);
    }
  }





  time_convert(num) {
    var minutes = Math.floor(num / 60);
    return minutes
  }

  getDriver() {
    return collectionData(this.driverCollection, {
      idField: 'id',
    }) as Observable<Drivers[]>;
  }


  update(pokemon: Drivers) {
    const pokemonDocumentReference = doc(
      this.firestore,
      `pokemon/${pokemon.Driver_id}`
    );
    return updateDoc(pokemonDocumentReference, { ...pokemon });
  }


  async uploadImage(cameraFile: Photo, uid: string): Promise<string | null> {
    const storageRef = ref(this.storage, `avatars/${uid}`);
    try {
      // Upload the image as a base64 string
      await uploadString(storageRef, cameraFile.base64String, 'base64');
      // Get the download URL for the uploaded image
      const imageUrl = await getDownloadURL(storageRef);
      // Reference to the user's document in Firestore
      const userDocRef = doc(this.firestore, `Riders/${uid}`);

      // Check if the document exists
      const docSnapshot = await getDoc(userDocRef);
      if (docSnapshot.exists()) {
        // If the document exists, update the photoURL field
        await updateDoc(userDocRef, { photoURL: imageUrl });
      } else {
        // If the document does not exist, create it with the photoURL field
        await setDoc(userDocRef, { photoURL: imageUrl }, { merge: true });
      }
      return imageUrl;
    } catch (e) {
      console.error('Error uploading image:', e);
      return null;
    }
  }



  async createUser(name, email, img, phone, uid) {
    try {
      const loc: Rider = {
        Loc_lat: 0,
        Loc_lng: 0,
        Rider_id: uid,
        Rider_name: name,
        Rider_phone: phone,
        Rider_imgUrl: img,
        Rider_rating: 0,
        Des_lat: 0,
        Des_lng: 0,
        Rider_Location: '',
        Rider_Destination: '',
        Rider_email: email,
        countDown: 0,
        cancel: false,
        price: 0,
        cash: true
      };
      await setDoc(doc(this.firestore, "Riders", uid), { ...loc });
      return true;
    } catch (e) {
      return null;
    }
  }


  getMessage() {
    //const userDocRef = collection(this.firestore, `Messages/${this.auth.currentUser.uid}/messages`);
    const userId = this.auth.currentUser?.uid;
    if (userId) {
      const messageDocRef = collection(this.firestore, `Messages/${userId}/messages`);
      const oderedMessages = query(messageDocRef, orderBy('createdAt', 'asc'));
      return collectionData(oderedMessages, { idField: 'id' });

    } else {
      return null;
    }

    //return collectionData(userDocRef);
  }

  getChatMessage(requestId: string) {
    const messagesRef = collection(this.firestore, `Request/${requestId}/messages`);
    return collectionData(messagesRef);
  }

  async addChatEnRouteMessage(msg: string, requestId: string) {
    const messagesRef = collection(this.firestore, `Request/${requestId}/messages`);
    return addDoc(messagesRef, {
      msg: msg,
      from: this.user.uid,
      createdAt: serverTimestamp(),
      myMsg: true,
      fromName: this.user.displayName
    });
  }


  async updatChatMessageInfo(requestId: string) {
    return await updateDoc(doc(this.firestore, `Request/${requestId}`),
      {
        name: this.user.displayName,
        id: this.user.uid,
        phone: this.user.phoneNumber,
        email: this.user.email,
        new: true
      });
  }


  getKnownPlaces(): Observable<any[]> {
    const userDocRef = collection(this.firestore, `Riders/${this.auth.currentUser.uid}/KnownPlaces`);
    return collectionData(userDocRef);
  }

  getAllBlogs() {
    const userDocRef = collection(this.firestore, `Blogs`);

    return collectionData(userDocRef);
  }


  getDrivers() {
    const userDocRef = collection(this.firestore, `Drivers`);
    return collectionData(userDocRef);
  }

  async addChatMessage(msg) {
    try {
      const userId = this.auth.currentUser?.uid;
      const userName = this.auth.currentUser?.displayName || 'Anonymous';

      if (!userId) {
        throw new Error('User is not authenticated.');
      }

      return await addDoc(collection(this.firestore, `Messages/${userId}/messages`), {
        msg: msg,
        from: userId,
        createdAt: serverTimestamp(),
        myMsg: true,
        fromName: userName
      });
    } catch (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }
  }

  async updateMessageInfo() {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User is not authenticated.');
    }

    return await setDoc(doc(this.firestore, `Messages/${user.uid}`), {
      name: user.displayName || 'Anonymous',
      id: user.uid,
      phone: user.phoneNumber || '',
      email: user.email || '',
      new: true
    });
  }

  async updateDriverOnlineState(ID) {
    try {
      const userDocRef = doc(this.firestore, 'Drivers', ID)
      await updateDoc(userDocRef, {
        onlineState: true,
      });
      return true;
    } catch (e) {
      //alert(e)
      console.log(e);
      return null;
    }
  }

  async checkCardExistsStripe(email: string, last4: string): Promise<boolean> {
    console.log('checkCardExistsStripe called with email:', email, 'and last4:', last4);

    const cardsCollectionRef = collection(this.firestore, `Riders/${this.user.uid}/cards`);
    console.log('cardsCollectionRef:', cardsCollectionRef);

    const cardQuery = query(cardsCollectionRef, where('last4', '==', last4));
    const cardDocs = await getDocs(cardQuery);

    console.log('Number of card documents found:', cardDocs.size);
    cardDocs.forEach(doc => {
      console.log('Found card:', doc.data());
    });

    return !cardDocs.empty;
  }



  async saveCard(cardDetails: { cardId: string; email: string, last4: string | number, brand?: string }) {
    console.log('Saving card with details:', cardDetails);

    const cardsCollectionRef = collection(this.firestore, `Riders/${this.user.uid}/cards`);
    const cardDocRef = doc(cardsCollectionRef, cardDetails.cardId);

    await setDoc(cardDocRef, cardDetails);
    console.log('Card saved successfully:', cardDetails);
  }


  async checkPaystackAuthCodeExists(authCode: string): Promise<boolean> {
    const authCodeCollectionRef = collection(this.firestore, 'paystackAuthCodes');
    const authCodeQuery = query(authCodeCollectionRef, where('authCode', '==', authCode));
    const authCodeDocs = await getDocs(authCodeQuery);

    return !authCodeDocs.empty;
  }

  async savePaystackAuthCode(authCode: string) {
    const authCodeDocRef = doc(this.firestore, `paystackAuthCodes/${authCode}`);
    await setDoc(authCodeDocRef, { authCode });
  }

  async updateFirestoreAfterPayment(paymentResult: any) {
    const paymentDocRef = doc(this.firestore, `Riders/${this.user.uid}/payments/lastpayment`);
    await setDoc(paymentDocRef, {
      paymentResult: paymentResult,
      paymentDate: new Date(),
    });
  }


  async getSavedPaymentMethods(): Promise<Card[]> {
    const paymentMethodsRef = collection(this.firestore, `Riders/${this.user.uid}/cards`);
    const snapshot = await getDocs(paymentMethodsRef);
    const methods: Card[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Card));
    return methods;
  }

  async deleteSavedPaymentMethod(methodId: string): Promise<void> {
    const paymentMethodDocRef = doc(this.firestore, `Riders/${this.user.uid}/cards/${methodId}`);
    await deleteDoc(paymentMethodDocRef);
  }

  async setActiveCard(email: string, cardId: string): Promise<void> {
    const userDocRef = doc(this.firestore, `Riders/${email}`);
    await setDoc(userDocRef, { activeCardId: cardId }, { merge: true });
  }

  getActiveCard(email: string): Observable<any> {
    const userDocRef = doc(this.firestore, `Riders/${email}`);
    return docData(userDocRef);
  }

  // Method to add a card for a user
  async addCardStripe(email: string, cardId: string, last4: string): Promise<void> {
    const userDocRef = doc(this.firestore, `Riders/${email}`);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();

    let cards = userData?.cards || [];
    cards.push({ cardId, last4 });

    await setDoc(userDocRef, { cards }, { merge: true });
  }

  async submitRating(ratingData: {
    rating: number,
    comment: string,
    driverId: string,
    requestId: string,
    timestamp: Date
  }) {
    try {
      const ratingRef = doc(this.firestore, `ratings/${ratingData.requestId}`);
      await setDoc(ratingRef, ratingData);
      console.log('Rating submitted successfully');
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw error;
    }
  }

  async getUserProfile() {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    try {
      const userDocRef = doc(this.firestore, 'Riders', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return userDoc.data();
      } else {
        // Create default profile if it doesn't exist (similar to loadUserProfile)
        const defaultProfile = {
          Rider_id: user.uid,
          Rider_name: user.displayName || 'Unknown',
          Rider_phone: user.phoneNumber || '',
          Rider_email: user.email || '',
          Rider_imgUrl: user.photoURL || '',
          Rider_rating: 0,
          Loc_lat: 0,
          Loc_lng: 0,
          Des_lat: 0,
          Des_lng: 0,
          Rider_Location: '',
          Rider_Destination: '',
          countDown: 0,
          cancel: false,
          price: 0,
          cash: true,
          createdAt: new Date().toISOString()
        };

        await setDoc(userDocRef, defaultProfile);
        return defaultProfile;
      }
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      let errorMsg = `Failed to get user profile: ${error.message}`;
      if (error.code === 'permission-denied') {
        errorMsg = 'Permission denied to access your profile. This is likely due to Firestore Security Rules in your new Firebase project. Please ensure rules allow reading from the "Riders" collection.';
      }
      throw new Error(errorMsg);
    }
  }

  async createUserProfile(profileData: any) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    const userDocRef = doc(this.firestore, 'Riders', user.uid);
    await setDoc(userDocRef, profileData, { merge: true });
    return profileData;
  }

  // Save ride history
  async saveRideHistory(rideData: any) {
    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId) throw new Error('No user ID found');

      // Ensure all required fields have valid values (not undefined)
      const historyData = {
        tripId: rideData.tripId || '',
        riderId: userId,
        driverId: rideData.driverId || '',
        driverName: rideData.driverName || rideData.Driver_name || 'Unknown Driver',
        driverImage: rideData.driverImage || rideData.Driver_imgUrl || '',
        driverCar: rideData.driverCar || rideData.Driver_car || '',
        driverPlate: rideData.driverPlate || rideData.Driver_plate || '',
        driverRating: rideData.driverRating || rideData.Driver_rating || 0,
        pickup: rideData.pickup || rideData.Rider_Location || 'Unknown pickup',
        destination: rideData.destination || rideData.Rider_Destination || 'Unknown destination',
        Loc_lat: rideData.Loc_lat || 0,
        Loc_lng: rideData.Loc_lng || 0,
        Des_lat: rideData.Des_lat || 0,
        Des_lng: rideData.Des_lng || 0,
        Rider_Location: rideData.Rider_Location || rideData.pickup || 'Unknown pickup',
        Rider_Destination: rideData.Rider_Destination || rideData.destination || 'Unknown destination',
        Driver_name: rideData.Driver_name || rideData.driverName || 'Unknown Driver',
        Driver_car: rideData.Driver_car || rideData.driverCar || '',
        Driver_imgUrl: rideData.Driver_imgUrl || rideData.driverImage || '',
        Driver_plate: rideData.Driver_plate || rideData.driverPlate || '',
        Driver_rating: rideData.Driver_rating || rideData.driverRating || rideData.rating || 0,
        price: typeof rideData.price === 'number' ? rideData.price : parseFloat(rideData.price || '0'),
        distance: typeof rideData.distance === 'number' ? rideData.distance : 0,
        duration: rideData.duration || '',
        rating: rideData.rating || rideData.Driver_rating || rideData.driverRating || 0,
        completed: rideData.completed || true,
        completedAt: rideData.completedAt || new Date(),
        timestamp: serverTimestamp()
      };

      // Log the data being saved for debugging
      console.log('Saving ride history with data:', historyData);

      // 1. Save to users/{userId}/rideHistory
      const userHistoryCollection = collection(this.firestore, `users/${userId}/rideHistory`);
      await addDoc(userHistoryCollection, historyData);

      // 2. Save to RideHistory collection
      const globalHistoryCollection = collection(this.firestore, 'RideHistory');
      await addDoc(globalHistoryCollection, historyData);

      console.log('Ride history saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving ride history:', error);
      // Return false instead of throwing to avoid crashing the ride stop process
      return false;
    }
  }

  // Get ride history
  getRideHistory() {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return [];

    const historyCollection = collection(this.firestore, `users/${userId}/rideHistory`);
    const historyQuery = query(historyCollection, orderBy('timestamp', 'desc'));

    return collectionData(historyQuery);
  }

}
