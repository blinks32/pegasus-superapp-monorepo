import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { collection, collectionData, CollectionReference, doc, docData, DocumentData, Firestore, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDoc, onSnapshot, query, orderBy, limit, writeBatch, getDocs, where } from '@angular/fire/firestore';
import { getDownloadURL, ref, Storage, uploadString, uploadBytes } from '@angular/fire/storage';
import { Photo } from '@capacitor/camera';
import { geohashForLocation } from 'geofire-common';
import { Observable, Subscription } from 'rxjs';
import { Card } from '../interfaces/card';
import { Drivers } from '../interfaces/drivers';
import { Rider } from '../interfaces/rider';
import { AuthService } from './auth.service';
import { v4 as uuidv4 } from 'uuid';
import { WalletTransaction, DriverWallet } from '../interfaces/payment';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  private driverCollection: CollectionReference<DocumentData>;
  directory: any;
  userUID: string;
  userName: string;
  userEmail: string;
  profile: DocumentData;
  pathM: string;
  private authStateSubscription: () => void;
  isRandom: any;
  user: User;


  constructor(
    private auth: Auth,
    public firestore: Firestore,
    private storage: Storage,
    private authService: AuthService,
    private settingsService: SettingsService
  ) {
    // Add connectivity check
    this.checkFirebaseConnectivity();
    
    this.authStateSubscription = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.user = user;
        console.log('User authenticated, loading profile...');
        try {
          await this.loadUserProfile();
        } catch (error) {
          console.error('Error loading user profile:', error);
          // Retry after a delay
          setTimeout(async () => {
            try {
              await this.loadUserProfile();
            } catch (retryError) {
              console.error('Retry failed for loading user profile:', retryError);
            }
          }, 3000);
        }
      } else {
        console.log("User not authenticated");
        this.userName = "None";
      }
    });
  }

  private async checkFirebaseConnectivity() {
    try {
      console.log('Checking Firebase connectivity...');
      console.log('Firebase config:', {
        projectId: this.firestore.app.options.projectId,
        authDomain: this.firestore.app.options.authDomain,
        apiKey: this.firestore.app.options.apiKey?.substring(0, 10) + '...'
      });
      
      // Try to read from a simple collection to test connectivity
      const testRef = collection(this.firestore, 'connectivity-test');
      const testQuery = query(testRef, limit(1));
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connectivity test timeout')), 10000)
      );
      
      await Promise.race([getDocs(testQuery), timeoutPromise]);
      console.log('Firebase connectivity: OK');
    } catch (error) {
      console.error('Firebase connectivity issue:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Log additional diagnostic information
      console.log('Network state:', navigator.onLine ? 'Online' : 'Offline');
      console.log('User agent:', navigator.userAgent);
      console.log('Platform:', window['Capacitor'] ? 'Native' : 'Web');
    }
  }

  // Public method to test connectivity
  async testConnectivity(): Promise<boolean> {
    try {
      await this.checkFirebaseConnectivity();
      return true;
    } catch (error) {
      console.error('Connectivity test failed:', error);
      return false;
    }
  }

  async loadUserProfile() {
    try {
      console.log('Loading user profile for UID:', this.user.uid);
      
      // Add timeout to prevent hanging
      const profilePromise = getDoc(doc(this.firestore, 'Drivers', this.user.uid));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile load timeout')), 15000)
      );
      
      const profileDoc = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (profileDoc.exists()) {
        this.profile = profileDoc.data();
        console.log('User profile loaded successfully');
      } else {
        console.log('No existing profile found - user needs to complete registration');
        // Don't auto-create profile, let the details page handle registration
        this.profile = null;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Set profile to null on error - don't create fallback profile
      this.profile = null;
      
      throw error;
    }
  }





  getUserProfile(user: User): Observable<DocumentData> {
    const userDocRef = doc(this.firestore, `Drivers/${user.uid}`);
    return docData(userDocRef);
  }

  async rejectRider(): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        cancel: true,
        start: false
      });
      await this.updateOnlineState(true);
      return true;
    } catch (e) {
      console.error('Error rejecting rider:', e);
      return false;
    }
  }

  async pickRider(): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        start: true,
      });
      return true;
    } catch (e) {
      console.error('Error picking rider:', e);
      return false;
    }
  }

  async endRide(): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        stop: true,
        start: false
      });
      return true;
    } catch (e) {
      console.error('Error ending ride:', e);
      return false;
    }
  }

  async saveCarInfo(uid: string, carInfo: any): Promise<void> {
    try {
      await setDoc(doc(this.firestore, `Drivers/${uid}/CarInfo`), carInfo);
    } catch (e) {
      console.error('Error saving car info:', e);
      throw new Error('Error saving car info');
    }
  }

  async saveDriverInfo(uid: string, driverInfo: any): Promise<void> {
    try {
      await setDoc(doc(this.firestore, `Drivers/${uid}/DriverInfo`), driverInfo);
    } catch (e) {
      console.error('Error saving driver info:', e);
      throw new Error('Error saving driver info');
    }
  }


  async createHistory(user: Rider): Promise<void> {
    try {
      const loc: Rider = {
        ...user,
        time: serverTimestamp(),
      };
      const historyId = uuidv4(); // Generate a random ID

      // Make sure to include the requestId in the history document
      await setDoc(doc(this.firestore, "Drivers", `${this.auth.currentUser.uid}/History/${historyId}`), {
        ...loc,
        requestId: user.requestId || loc.requestId  // Include requestId
      });

      await setDoc(doc(this.firestore, `AllRides/${this.auth.currentUser.uid}/customer/${historyId}`), { ...loc });
    } catch (e) {
      console.error('Error creating history:', e);
      throw new Error('Error creating history');
    }
  }

  async getOnlineState(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'Drivers', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('Fetched data:', data); // Log the fetched data
        return data.onlineState;
      }
    }
    throw new Error('User not authenticated or document does not exist');
  }
  async goOffline(): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "Drivers", this.auth.currentUser.uid));
    } catch (e) {
      console.error('Error going offline:', e);
      throw new Error('Error going offline');
    }
  }

  async deleteDriverFromRequest(ID: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "Request", ID));
    } catch (e) {
      console.error('Error deleting driver from request:', e);
      throw new Error('Error deleting driver from request');
    }
  }

  async updateCountDown(time: number): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        countDown: time,
      });
      return true;
    } catch (e) {
      console.error('Error updating countdown:', e);
      return false;
    }
  }

  getMessage() {
    const userDocRef = collection(this.firestore, `Messages/${this.auth.currentUser.uid}/messages`);
    return collectionData(userDocRef);
  }

  getChatMessage(ID) {
    const userDocRef = collection(this.firestore, `Request/${ID}/messages`);
    return collectionData(userDocRef);
  }

  async addChatEnRouteMessage(msg, iD) {
    return await addDoc(collection(this.firestore, `Request/${iD}/messages`), {
      msg: msg,
      from: this.auth.currentUser.uid,
      createdAt: serverTimestamp(),
      myMsg: true,
      fromName: this.profile.Rider_name
    });
  }

  async updatChatMessageInfo(id) {
    return await setDoc(doc(this.firestore, `Request/${id}/`),
      {
        name: this.profile.Rider_name,
        id: this.profile.Rider_id,
        phone: this.profile.Rider_phone,
        email: this.profile.Rider_email,
        new: true
      }
    )
  }

  async pushDriverToRequest(coord: any, name: string, email: string, phone: any, car: string, cartype: string, plate: string, imageUrl: string, document: string, ID: any): Promise<void> {
    try {
      const loc: Drivers = {
        geohash: geohashForLocation([coord.coords.latitude, coord.coords.longitude]),
        Driver_lat: coord.coords.latitude,
        Driver_lng: coord.coords.longitude,
        Driver_id: this.auth.currentUser.uid,
        Driver_name: name,
        Driver_car: car,
        Driver_imgUrl: imageUrl,
        Driver_rating: 0,
        distance: 0,
        duration: 0,
        seats: 1,
        start: false,
        stop: false,
        intransit: false,
        cancel: false,
        Driver_cartype: cartype,
        Driver_plate: plate,
        Driver_num_rides: 0,
        Document: document,
        Driver_email: email,
        Driver_phone: phone,
        onlineState: false,
        Earnings: 0,
        license: undefined,
        mileage: undefined,
        isApproved: false,
        submissionDate: undefined
      };
      await updateDoc(doc(this.firestore, "Request", ID), { ...loc });
    } catch (e) {
      console.error('Error pushing driver to request:', e);
      throw new Error('Error pushing driver to request');
    }
  }

  async createNewDriver(coord: any, name: string, email: string, phone: any, car: string, cartype: string, plate: string, imageUrl: string, document: string, license: any, mileage: any): Promise<void> {
    try {
      const loc: Drivers = {
        geohash: geohashForLocation([coord.coords.latitude, coord.coords.longitude]),
        Driver_lat: coord.coords.latitude,
        Driver_lng: coord.coords.longitude,
        Driver_id: this.auth.currentUser.uid,
        Driver_name: name,
        Driver_car: car,
        Driver_imgUrl: imageUrl,
        Driver_rating: 0,
        distance: 0,
        duration: 0,
        seats: 1,
        start: false,
        stop: false,
        intransit: false,
        cancel: false,
        Driver_cartype: cartype,
        Driver_plate: plate,
        Driver_num_rides: 0,
        Document: document,
        Driver_email: email,
        Driver_phone: phone,
        onlineState: false,
        Earnings: 0,
        license: license || null,
        mileage: mileage || null,
        isApproved: false,
        submissionDate: serverTimestamp()
      };
      await setDoc(doc(this.firestore, "Drivers", this.auth.currentUser.uid), { ...loc });
    } catch (e) {
      console.error('Error creating new driver:', e);
      throw new Error('Error creating new driver');
    }
  }

  getDriver(): Observable<Drivers[]> {
    return collectionData(this.driverCollection, {
      idField: 'id',
    }) as Observable<Drivers[]>;
  }

  /**
   * Check if a driver already exists with the given phone number
   * Used to restrict SMS sign-in to first-time users only
   */
  async checkDriverExistsByPhone(phoneNumber: string): Promise<boolean> {
    try {
      const driversRef = collection(this.firestore, 'Drivers');
      const q = query(driversRef, where('Driver_phone', '==', phoneNumber));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking driver existence:', error);
      // On error, allow sign-in attempt (fail open for better UX)
      return false;
    }
  }

  /**
   * Check if a driver document exists by UID
   * Returns the driver document data if exists, null otherwise
   */
  async checkDriverExistsByUid(uid: string): Promise<DocumentData | null> {
    try {
      const driverDocRef = doc(this.firestore, `Drivers/${uid}`);
      const driverDoc = await getDoc(driverDocRef);
      
      if (driverDoc.exists()) {
        const data = driverDoc.data();
        // Check if the driver has completed registration (has required fields)
        if (data && data.Driver_name && data.isApproved !== undefined) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking driver existence by UID:', error);
      return null;
    }
  }

  async getUserType(uid: string): Promise<string | null> {
    const userDocRef = doc(this.firestore, `Riders/${uid}`);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return 'rider';
    }
    return null;
  }

  updateDriver(driver: Drivers): Promise<void> {
    const driverDocRef = doc(this.firestore, `Drivers/${driver.Driver_id}`);
    return updateDoc(driverDocRef, { ...driver });
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


  //  async uploadImage(cameraFile: Photo, uid: string): Promise<string> {
  //     try {
  //       console.log('Starting image upload for uid:', uid);

  //       if (!cameraFile.base64String) {
  //         console.error('No base64 string in camera file');
  //         throw new Error('No image data provided');
  //       }

  //       console.log('Base64 string length:', cameraFile.base64String.length);

  //       const timestamp = Date.now();
  //       const fileName = `avatars/${uid}_${timestamp}.jpg`;
  //       console.log('Uploading to:', fileName);

  //       const storageRef = ref(this.storage, fileName);

  //       // ---------- BLOB CONVERSION (unchanged) ----------
  //       const byteCharacters = atob(cameraFile.base64String);
  //       const byteNumbers = new Array(byteCharacters.length);
  //       for (let i = 0; i < byteCharacters.length; i++) {
  //         byteNumbers[i] = byteCharacters.charCodeAt(i);
  //       }
  //       const byteArray = new Uint8Array(byteNumbers);
  //       const blob = new Blob([byteArray], { type: 'image/jpeg' });

  //       console.log('Blob created, size:', blob.size);

  //       // ---------- UPLOAD (modular SDK) ----------
  //       console.log('Starting upload...');
  //       const uploadResult = await uploadBytes(storageRef, blob, {
  //         contentType: 'image/jpeg',
  //         customMetadata: {
  //           uploadedBy: uid,
  //           uploadedAt: timestamp.toString(),
  //         },
  //       });

  //       console.log('Upload complete, uploadResult:', uploadResult);

  //       // ---------- GET DOWNLOAD URL (with retry) ----------
  //       let imageUrl = '';
  //       let retries = 3;
  //       while (retries > 0) {
  //         try {
  //           imageUrl = await getDownloadURL(uploadResult.ref);
  //           if (imageUrl) break;
  //         } catch (urlError) {
  //           console.error(`DownloadURL attempt ${4 - retries} failed:`, urlError);
  //           retries--;
  //           if (retries === 0) throw new Error('Failed to get download URL');
  //           await new Promise(r => setTimeout(r, 1000));
  //         }
  //       }

  //       // ---------- FIRESTORE UPDATE (unchanged) ----------
  //       const userDocRef = doc(this.firestore, `Drivers/${uid}`);
  //       const snap = await getDoc(userDocRef);
  //       if (snap.exists()) {
  //         await updateDoc(userDocRef, { Driver_imgUrl: imageUrl });
  //         console.log('Updated existing driver document');
  //       } else {
  //         await setDoc(userDocRef, { Driver_imgUrl: imageUrl }, { merge: true });
  //         console.log('Created new driver document');
  //       }

  //       console.log('Image upload complete! Final URL:', imageUrl);
  //       return imageUrl;
  //     } catch (e: any) {
  //       console.error('Error uploading image:', e);
  //       console.error('Code:', e.code);
  //       console.error('Message:', e.message);
  //       throw e;          // keep throwing – caller shows the alert
  //     }

  //   }

  getCards(): Observable<DocumentData[]> {
    const userDocRef = collection(this.firestore, `Drivers/${this.auth.currentUser.uid}/Cards`);
    return collectionData(userDocRef);
  }

  getEarnings(): Observable<DocumentData> {
    const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
    return docData(userDocRef);
  }
 getCartypes(): Observable<DocumentData[]> {
    console.log('Fetching cartypes from Firestore...');
    const cartypesRef = collection(this.firestore, `Cartypes`);
    
    return new Observable(observer => {
      // Set a timeout for the Firestore request
      const timeoutId = setTimeout(() => {
        console.log('Cartypes fetch timed out, using mock data');
        const mockCartypes = [
          { id: 'sedan', name: 'Sedan' },
          { id: 'suv', name: 'SUV' },
          { id: 'hatchback', name: 'Hatchback' },
          { id: 'pickup', name: 'Pickup Truck' },
          { id: 'van', name: 'Van' },
          { id: 'coupe', name: 'Coupe' }
        ];
        observer.next(mockCartypes);
        observer.complete();
      }, 10000); // 10 second timeout

      collectionData(cartypesRef).subscribe({
        next: (data) => {
          clearTimeout(timeoutId);
          console.log('Cartypes received from Firestore:', data);
          
          // If no data is returned from Firestore, use mock data
          if (!data || data.length === 0) {
            console.log('No cartypes found in Firestore, using mock data');
            const mockCartypes = [
              { id: 'sedan', name: 'Sedan' },
              { id: 'suv', name: 'SUV' },
              { id: 'hatchback', name: 'Hatchback' },
              { id: 'pickup', name: 'Pickup Truck' },
              { id: 'van', name: 'Van' },
              { id: 'coupe', name: 'Coupe' }
            ];
            observer.next(mockCartypes);
          } else {
            observer.next(data);
          }
        },
        error: (error) => {
          clearTimeout(timeoutId);
          console.error('Error fetching cartypes from Firestore:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          
          // Provide mock data on error
          const mockCartypes = [
            { id: 'sedan', name: 'Sedan' },
            { id: 'suv', name: 'SUV' },
            { id: 'hatchback', name: 'Hatchback' },
            { id: 'pickup', name: 'Pickup Truck' },
            { id: 'van', name: 'Van' },
            { id: 'coupe', name: 'Coupe' }
          ];
          observer.next(mockCartypes);
        },
        complete: () => {
          clearTimeout(timeoutId);
          observer.complete();
        }
      });
    });
  }
  // getCartypes(): Observable<DocumentData[]> {
  //   try {
  //     console.log('Fetching cartypes from Firestore...');
  //     const cartypesRef = collection(this.firestore, `Cartypes`);
  //     const cartypesObservable = collectionData(cartypesRef);
      
  //     // Add error handling to the observable
  //     return new Observable(observer => {
  //       cartypesObservable.subscribe({
  //         next: (data) => {
  //           console.log('Cartypes fetched successfully:', data);
  //           observer.next(data);
  //         },
  //         error: (error) => {
  //           console.error('Error fetching cartypes:', error);
  //           console.error('Error code:', error.code);
  //           console.error('Error message:', error.message);
  //           observer.error(error);
  //         },
  //         complete: () => {
  //           console.log('Cartypes fetch completed');
  //           observer.complete();
  //         }
  //       });
  //     });
  //   } catch (error) {
  //     console.error('Error in getCartypes method:', error);
  //     throw error;
  //   }
  // }

  getRequests(): Observable<DocumentData> {
    const requestsRef = doc(this.firestore, `Request/${this.auth.currentUser.uid}`);
    return docData(requestsRef);
  }

  getDrivers(): Observable<DocumentData[]> {
    const driversRef = collection(this.firestore, `Drivers`);
    return collectionData(driversRef);
  }

  async addChatMessage(msg: string): Promise<void> {
    try {
      await addDoc(collection(this.firestore, `Messages/${this.profile.Driver_id}/messages`), {
        msg,
        from: this.auth.currentUser.uid,
        createdAt: serverTimestamp(),
        myMsg: true,
        fromName: this.profile.Driver_name
      });
    } catch (e) {
      console.error('Error adding chat message:', e);
      throw new Error('Error adding chat message');
    }
  }

  async createCard(name: string, number: any, type: string, id: string): Promise<boolean> {
    try {
      const card: Card = {
        name,
        number,
        type,
        id,
        selected: true
      };
      await setDoc(doc(this.firestore, `Drivers/${this.auth.currentUser.uid}/Cards/${name}`), { ...card });
      return true;
    } catch (e) {
      console.error('Error creating card:', e);
      return false;
    }
  }

  async updateCard(name: string, number: any, type: string, id: string, state: boolean): Promise<boolean> {
    try {
      const card: Card = {
        name,
        number,
        type,
        id,
        selected: state
      };
      await updateDoc(doc(this.firestore, `Drivers/${this.profile.Rider_id}/Cards/${name}`), { ...card });
      return true;
    } catch (e) {
      console.error('Error updating card:', e);
      return false;
    }
  }

  async updateOnlineState(state: boolean): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'Drivers', user.uid);
      await setDoc(userDocRef, { onlineState: state }, { merge: true });
    }
  }

  async updateAvailableForSharing(available: boolean): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'Drivers', user.uid);
      await setDoc(userDocRef, { availableForSharing: available }, { merge: true });
    }
  }


  getRiderLocation(riderId: string): Promise<{ lat: number, lng: number } | null> {
    return new Promise((resolve, reject) => {
      const riderDocRef = doc(this.firestore, 'Riders', riderId);
      onSnapshot(riderDocRef, (doc) => {
        const data = doc.data();
        if (data && data.Loc_lat) {
          const riderlocation = {
            lat: data.Loc_lat,
            lng: data.Loc_lng
          };
          resolve(riderlocation);
        } else {
          resolve(null);
        }
      }, (error) => {
        reject(error);
      });
    });
  }


  async updateDriverLocation(coord: { lat: number, lng: number }): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
      await updateDoc(userDocRef, {
        geohash: geohashForLocation([coord.lat, coord.lng]),
        Driver_lat: coord.lat,
        Driver_lng: coord.lng,
      });
      return true;
    } catch (e) {
      console.error('Error updating driver location:', e);
      return false;
    }
  }




  async updateEarnings(value: number): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
      await updateDoc(userDocRef, { Earnings: value });
      return true;
    } catch (e) {
      console.error('Error updating earnings:', e);
      return false;
    }
  }

  ngOnDestroy(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription();
    }
  }

  async initializeWallet(driverId: string): Promise<void> {
    const walletRef = doc(this.firestore, `Drivers/${driverId}/wallet/main`);
    const defaultWallet: DriverWallet = {
      balance: 0,
      currency: this.settingsService.currency,
      lastUpdated: serverTimestamp(),
      isVerified: false
    };

    await setDoc(walletRef, defaultWallet);
  }

  getWalletBalance(): Observable<DriverWallet> {
    const walletRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}/Earnings`);
    return docData(walletRef) as Observable<DriverWallet>;
  }

  getWalletTransactions(limitCount: number = 10): Observable<WalletTransaction[]> {
    const transactionsRef = collection(
      this.firestore,
      `Drivers/${this.auth.currentUser.uid}/wallet/main/transactions`
    );
    return collectionData(
      query(transactionsRef, orderBy('timestamp', 'desc'), limit(limitCount))
    ) as Observable<WalletTransaction[]>;
  }

  async addTransaction(transaction: Partial<WalletTransaction>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const driverId = this.auth.currentUser.uid;

    // Get current wallet
    const walletRef = doc(this.firestore, `Drivers/${driverId}/wallet/main`);
    const walletSnap = await getDoc(walletRef);
    const currentWallet = walletSnap.data() as DriverWallet;

    // Calculate new balance
    const amount = transaction.type === 'credit' ? transaction.amount : -transaction.amount;
    const newBalance = (currentWallet.balance || 0) + amount;

    // Update wallet
    batch.update(walletRef, {
      balance: newBalance,
      lastUpdated: serverTimestamp()
    });

    // Add transaction
    const transactionRef = doc(collection(this.firestore, `Drivers/${driverId}/wallet/main/transactions`));
    const newTransaction: WalletTransaction = {
      id: transactionRef.id,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      timestamp: serverTimestamp(),
      status: 'completed',
      reference: transaction.reference,
      balance: newBalance
    };

    batch.set(transactionRef, newTransaction);
    await batch.commit();
  }

  async updateTripRating(requestId: string, rating: number, comment: string) {
    try {
      const user = this.auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Update in TripHistory collection
      const tripHistoryRef = collection(this.firestore, `Drivers/${user.uid}/TripHistory`);
      const tripHistoryQuery = query(tripHistoryRef, where('requestId', '==', requestId));
      const tripHistorySnapshot = await getDocs(tripHistoryQuery);

      if (!tripHistorySnapshot.empty) {
        const tripDoc = tripHistorySnapshot.docs[0];
        await updateDoc(doc(tripHistoryRef, tripDoc.id), {
          driverRating: rating,
          driverComment: comment
        });
      }

      // Update in History collection that's used by the history page
      const historyRef = collection(this.firestore, `Drivers/${user.uid}/History`);
      const historyQuery = query(historyRef, where('requestId', '==', requestId));
      const historySnapshot = await getDocs(historyQuery);

      if (!historySnapshot.empty) {
        const historyDoc = historySnapshot.docs[0];
        await updateDoc(doc(historyRef, historyDoc.id), {
          driverRating: rating,  // Changed from Rider_rating to driverRating for consistency
          driverComment: comment
        });
      } else {
        console.warn('Could not find history document with requestId:', requestId);
      }

      return true;
    } catch (error) {
      console.error('Error updating trip rating:', error);
      throw error;
    }
  }
}


