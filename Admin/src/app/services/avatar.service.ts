import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { collection, collectionData, CollectionReference, doc, docData, DocumentData, Firestore, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, query, orderBy, where, getDocs, limit } from '@angular/fire/firestore';
import {
  getDownloadURL,
  ref,
  Storage,
  uploadString,
  uploadBytes
} from '@angular/fire/storage';
import { Router } from '@angular/router';
import { Photo } from '@capacitor/camera';
import { geohashForLocation } from 'geofire-common';
import { combineLatest, Observable, of } from 'rxjs';
import { Admin } from '../interfaces/admin';
import { Card } from '../interfaces/card';
import { docs } from '../interfaces/docs';
import { Drivers } from '../interfaces/drivers';
import { DriverUpdate } from '../interfaces/driverUpdate';
import { Rider } from '../interfaces/rider';
import { AuthService } from './auth.service';
import { catchError, map, switchMap } from 'rxjs/operators';

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

  constructor(
    private auth: Auth,
    public firestore: Firestore,
    private storage: Storage,
    private router: Router
  ) {
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        this.driverCollection = collection(this.firestore, 'Drivers');

        this.getUserProfile(user).subscribe({
          next: async (data) => {
            this.profile = data;
            console.log('Admin profile data:', data);

            if (this.profile) {
              if (this.profile.Access) {
                this.initializeDefaultData();
              }

              if (!this.profile.Access && this.router.url !== '/details') {
                console.log('Access denied, navigating to details');
                this.router.navigateByUrl('details');
              }

              if (this.profile.Driver_name)
                this.userName = this.profile.Driver_name;

              this.pathM = `uploads/${this.profile.uid}/profile.png`;
            } else {
              console.log('Profile missing, navigating to details');
              if (this.router.url !== '/details') {
                this.router.navigateByUrl('details');
              }
            }
          },
          error: (error) => {
            console.error('Error in Admin profile subscription:', error);
            if (error.code === 'permission-denied') {
              alert('Permission denied to access Admin profile.');
            }
          }
        })

      } else {
        this.userName = "None";

      }
    })
  }

  get user() {
    return this.auth.currentUser;
  }

  async getSavedPaymentMethods(): Promise<Card[]> {
    const paymentMethodsRef = collection(this.firestore, `Admins/${this.user.uid}/cards`);
    const snapshot = await getDocs(paymentMethodsRef);
    const methods: Card[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Card));
    return methods;
  }

  async setActiveCard(email: string, cardId: string): Promise<void> {
    const userDocRef = doc(this.firestore, `Admins/${this.user.uid}`);
    await setDoc(userDocRef, { activeCardId: cardId }, { merge: true });
  }

  getActiveCard(email: string): Observable<any> {
    const userDocRef = doc(this.firestore, `Admins/${this.user.uid}`);
    return docData(userDocRef);
  }

  async deleteSavedPaymentMethod(methodId: string): Promise<void> {
    const paymentMethodDocRef = doc(this.firestore, `Admins/${this.user.uid}/cards/${methodId}`);
    await deleteDoc(paymentMethodDocRef);
  }

  async updateFirestoreAfterPayment(paymentResult: any) {
    const paymentDocRef = doc(this.firestore, `Admins/${this.user.uid}/payments/lastpayment`);
    await setDoc(paymentDocRef, {
      paymentResult: paymentResult,
      paymentDate: new Date(),
    });
  }

  async checkCardExistsStripe(email: string, last4: string): Promise<boolean> {
    const cardsCollectionRef = collection(this.firestore, `Admins/${this.user.uid}/cards`);
    const cardQuery = query(cardsCollectionRef, where('last4', '==', last4));
    const cardDocs = await getDocs(cardQuery);
    return !cardDocs.empty;
  }

  async addCardStripe(email: string, cardId: string, last4: string): Promise<void> {
    const cardsCollectionRef = collection(this.firestore, `Admins/${this.user.uid}/cards`);
    const cardDocRef = doc(cardsCollectionRef, cardId);
    await setDoc(cardDocRef, { cardId, last4 }, { merge: true });
  }

  getUserProfile(user) {
    const userDocRef = doc(this.firestore, `Admins/${user.uid}`);
    return docData(userDocRef);
  }

  async createItem(data: any): Promise<void> {
    const itemsCollection = collection(this.firestore, 'items');
    await addDoc(itemsCollection, data);
  }

  async RequestRideWithRiderDetails(user_Loc_coord, user_Des_coord, ID) {
    try {
      const loc: Rider = {
        Loc_lat: 5.5096,
        Loc_lng: 7.0391,
        Rider_id: 'syusyugdshgsghdsdssd',
        Rider_name: "Chinedu",
        Rider_phone: 6478947352,
        Rider_imgUrl: "https://avatars.githubusercontent.com/u/7928001?v=4",
        Rider_rating: 3,
        Des_lat: user_Des_coord.lat,
        Des_lng: user_Des_coord.lng,
        Rider_Location: 'Owerri Imo State',
        Rider_Destination: 'Kenville Hotels Amabar',
        Rider_email: 'chndht@gmiail.ccjd',
        countDown: 10,
        cancel: false,
        price: 2230,
        cash: true,
        time: '',
        notificationID: undefined
      };

      const userDocRef = doc(this.firestore, 'Drivers', ID)
      await updateDoc(userDocRef, { onlineState: false });
      console.log('deleted current driver ID');
      await setDoc(doc(this.firestore, "Request", ID), { ...loc });
      console.log('Added New driver ID');
    } catch (e) {
      throw new Error(e);
    }
  }


  async RejectRider() {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid)
      await updateDoc(userDocRef, {
        cancel: true,
        start: false
      });
      this.updateOnlineState(true);
      return true;
    } catch (e) {
      alert(e)
      return null;
    }
  }

  async PickRider() {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid)
      await updateDoc(userDocRef, {
        start: true,
      });
      // this.updateOnlineState(true);
      return true;
    } catch (e) {
      alert(e)
      return null;
    }
  }


  async EndRide() {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid)
      await updateDoc(userDocRef, {
        stop: true,
        start: false
      });
      // this.updateOnlineState(true);
      return true;
    } catch (e) {
      alert(e)
      return null;
    }
  }


  async createHistory(user) {
    try {
      const loc: Rider = {
        Loc_lat: user.Loc_lat,
        Loc_lng: user.Loc_lng,
        Rider_id: user.Rider_id,
        Rider_name: user.Rider_name,
        Rider_phone: user.Rider_phone,
        Rider_imgUrl: user.Rider_imgUrl,
        Rider_rating: user.Rider_rating,
        Des_lat: user.Des_lat,
        Des_lng: user.Des_lng,
        Rider_Location: user.Rider_Location,
        Rider_Destination: user.Rider_Destination,
        Rider_email: user.Rider_email,
        countDown: 0,
        cancel: false,
        price: user.price,
        cash: user.cash,
        time: serverTimestamp(),
        notificationID: ''
      };
      await setDoc(doc(this.firestore, "Drivers", `${this.auth.currentUser.uid}/History/${user.Rider_id}`), { ...loc });
      await setDoc(doc(this.firestore, "AllRides", `${this.auth.currentUser.uid}/customer/${user.Rider_id}`), { ...loc });
    } catch (e) {
      alert(e)
    }
  }



  //GO offline()

  async goOffline() {
    await deleteDoc(doc(this.firestore, "Drivers", this.auth.currentUser.uid));
  }

  //delete the driver that has a request sent to him.
  async deleDriverFromRequest(ID) {
    await deleteDoc(doc(this.firestore, "Request", ID))
  }


  async UpdateCountDown(time) {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid)
      await updateDoc(userDocRef, {
        countDown: time,
      });
      return true;
    } catch (e) {
      alert(e)
      return null;
    }
  }


  //Push driver info into the request database
  async PushDriverToRequest(coord, name, email, phone, car, cartype, plate, imageUrl, document) {
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
        Approved: false
      };
      await updateDoc(doc(this.firestore, "Request", this.auth.currentUser.uid), { ...loc });
    } catch (e) {
      throw new Error(e);
    }

    console.log('done')
  }


  ///create a new driver and publish info to database
  async CreateAdmin(name, email, phone, role, imageUrl, state, coordinates: any) {
    try {
      const loc: Admin = {
        name: name,
        email: email,
        phone: phone,
        imageUrl: imageUrl,
        role: role,
        Access: state
      };
      await setDoc(doc(this.firestore, "Admins", this.auth.currentUser.uid), { ...loc });
    } catch (e) {
      throw new Error(e);
    }
  }


  ///create a new driver and publish info to database
  async UpdateDriver(coord, name, email, phone, car, cartype, plate, imageUrl, document, id) {
    try {
      const loc: DriverUpdate = {
        geohash: geohashForLocation([coord.coords.latitude, coord.coords.longitude]),
        Driver_lat: coord.coords.latitude,
        Driver_lng: coord.coords.longitude,
        Driver_id: id,
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
      };
      await updateDoc(doc(this.firestore, "Drivers", id), { ...loc });
    } catch (e) {
      throw new Error(e);
    }
  }


  ///create a new driver and publish info to database
  async CreateNewDriver(coord, name, email, phone, car, cartype, plate, imageUrl, document) {
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
        Approved: false
      };
      await setDoc(doc(this.firestore, "Drivers", this.auth.currentUser.uid), { ...loc });
    } catch (e) {
      throw new Error(e);
    }
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


  async uploadImage(cameraFile: Photo, uid) {

    const storageRef = ref(this.storage, this.pathM);

    try {
      await uploadString(storageRef, cameraFile.base64String, 'base64');

      const imageUrl = await getDownloadURL(storageRef);

      const userDocRef = doc(this.firestore, `Drivers/${uid}`);
      await setDoc(userDocRef, {
        imageUrl,
      });
      return true;
    } catch (e) {
      console.log(e);
      return null;
    }
  }


  async uploadCartype(cameraFile: Photo, uid) {

    const storageRef = ref(this.storage, `uploads/${uid}/profile.png`);

    try {
      await uploadString(storageRef, cameraFile.base64String, 'base64');

      const imageUrl = await getDownloadURL(storageRef);

      const userDocRef = doc(this.firestore, `Cartypes/${uid}`);
      await updateDoc(userDocRef, {
        image: imageUrl,
        id: uid
      });
      return true;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  getMessage(uid) {
    const userDocRef = collection(this.firestore, `Messages/${uid}/messages`);
    const q = query(userDocRef, orderBy('createdAt', 'asc'));
    return collectionData(q).pipe(
      map((messages: any[]) => {
        const currentUid = this.auth.currentUser?.uid;
        return messages.map(msg => ({
          ...msg,
          myMsg: msg.from === currentUid
        }));
      })
    );
  }

  getDocument(uid) {
    const userDocRef = collection(this.firestore, `Drivers/${uid}/Documents`);
    return collectionData(userDocRef);
  }

  getMessages() {
    return collectionData(collection(this.firestore, `Messages`));
  }


  getCancelledTrips() {
    const userDocRef = collection(this.firestore, `CancelledRides`);
    return collectionData(userDocRef);
  }

  getCards() {
    const userDocRef = collection(this.firestore, `Drivers/${this.auth.currentUser.uid}/Cards`);
    return collectionData(userDocRef);
  }

  getEarnings() {
    const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
    return docData(userDocRef);
  }
  getTotalEarnings(): Observable<{ Earnings: number }> {
    const driversRef = collection(this.firestore, 'Drivers');
    return collectionData(driversRef, { idField: 'uid' }).pipe(
      map((drivers: any[]) => {
        let totalEarnings = 0;
        drivers.forEach(driver => {
          // Ensure we treat Earnings as a number
          const driverEarnings = Number(driver.Earnings) || 0;
          totalEarnings += driverEarnings;
        });
        return { Earnings: totalEarnings };
      }),
      catchError(err => {
        console.warn('Error in getTotalEarnings (likely permissions):', err);
        return of({ Earnings: 0 });
      })
    );
  }

  getCartypes() {
    const userDocRef = collection(this.firestore, `Cartypes`);
    return collectionData(userDocRef, { idField: 'id' }).pipe(
      catchError(err => {
        console.warn('Error in getCartypes:', err);
        return of([]);
      })
    );
  }

  getPrices() {
    const userDocRef = collection(this.firestore, `prices`);
    return collectionData(userDocRef).pipe(
      catchError(err => {
        console.warn('Error in getPrices:', err);
        return of([]);
      })
    );
  }

  getDocuments() {
    this.ensureDocumentNode();
    const userDocRef = collection(this.firestore, `Documents`);
    return collectionData(userDocRef).pipe(
      catchError(err => {
        console.warn('Error in getDocuments:', err);
        return of([]);
      })
    );
  }

  private ensureDocumentNode(): void {
    const defaultDocRef = doc(this.firestore, 'Documents', '_init');
    void setDoc(defaultDocRef, { placeholder: true }, { merge: true });
  }

  getRoles() {
    const rolesRef = collection(this.firestore, 'Roles');
    return collectionData(rolesRef).pipe(
      catchError(err => {
        console.warn('Error in getRoles:', err);
        return of([]);
      })
    );
  }

  getRequests() {
    const userDocRef = doc(this.firestore, `Request/${this.auth.currentUser.uid}`);
    return docData(userDocRef).pipe(
      catchError(err => {
        console.warn('Error in getRequests:', err);
        return of(null);
      })
    );
  }

  getDrivers(): Observable<any[]> {
    const driversRef = collection(this.firestore, 'Drivers');
    return collectionData(driversRef).pipe(
      catchError(err => {
        console.warn('Error in getDrivers:', err);
        return of([]);
      })
    );
  }

  getDriverRatings(driverId: string): Observable<any[]> {
    const ratingRef = collection(this.firestore, `Drivers/${driverId}/rating`);
    return collectionData(ratingRef).pipe(
      catchError(err => {
        console.warn('Error in getDriverRatings:', err);
        return of([]);
      })
    );
  }

  getDriverRatingCount(driverId: string): Observable<any[]> {
    const ratingCountRef = collection(this.firestore, `Drivers/${driverId}/ratingCount`);
    return collectionData(ratingCountRef).pipe(
      catchError(err => {
        console.warn('Error in getDriverRatingCount:', err);
        return of([]);
      })
    );
  }

  getTrips(): Observable<any[]> {
    const tripsRef = collection(this.firestore, 'Request');
    return collectionData(tripsRef).pipe(
      catchError(err => {
        console.warn('Error in getTrips:', err);
        return of([]);
      })
    );
  }

  getActiveRides(): Observable<any[]> {
    const activeRidesRef = collection(this.firestore, 'Request');
    return collectionData(activeRidesRef).pipe(
      catchError(err => {
        console.warn('Error in getActiveRides:', err);
        return of([]);
      })
    );
  }

  getCancelledRides(): Observable<any[]> {
    const cancelledRidesRef = collection(this.firestore, 'CancelledRides');
    return collectionData(cancelledRidesRef).pipe(
      catchError(err => {
        console.warn('Error in getCancelledRides:', err);
        return of([]);
      })
    );
  }

  getPayments(): Observable<any[]> {
    const paymentsRef = collection(this.firestore, 'Payments');
    return collectionData(paymentsRef).pipe(
      catchError(err => {
        console.warn('Error in getPayments:', err);
        return of([]);
      })
    );
  }

  getAllBlogs(): Observable<any[]> {
    const blogsRef = collection(this.firestore, 'Blogs');
    return collectionData(blogsRef).pipe(
      catchError(err => {
        console.warn('Error in getAllBlogs:', err);
        return of([]);
      })
    );
  }

  getAllDocuments(): Observable<any[]> {
    const documentsRef = collection(this.firestore, 'Documents');
    return collectionData(documentsRef).pipe(
      catchError(err => {
        console.warn('Error in getAllDocuments:', err);
        return of([]);
      })
    );
  }

  getAllCarTypes(): Observable<any[]> {
    const carTypesRef = collection(this.firestore, 'Cartypes');
    return collectionData(carTypesRef).pipe(
      catchError(err => {
        console.warn('Error in getAllCarTypes:', err);
        return of([]);
      })
    );
  }

  getAllPrices(): Observable<any[]> {
    const pricesRef = collection(this.firestore, 'prices');
    return collectionData(pricesRef).pipe(
      catchError(err => {
        console.warn('Error in getAllPrices:', err);
        return of([]);
      })
    );
  }


  getRiders() {
    const userDocRef = collection(this.firestore, `Riders`);
    return collectionData(userDocRef).pipe(
      catchError(err => {
        console.warn('Error in getRiders:', err);
        return of([]);
      })
    );
  }

  async addChatMessage(msg, uid) {
    return await addDoc(collection(this.firestore, `Messages/${uid}/messages`), {
      msg: msg,
      from: this.auth.currentUser.uid,
      createdAt: serverTimestamp(),
      myMsg: false,
      fromName: this.profile.name
    });
  }

  async createDocument(name, type, id, image, text, targetUid?) {
    try {
      const uid = targetUid || this.auth.currentUser.uid;
      const loc: docs = {
        name: name,
        type: type,
        id: id,
        image: image,
        text: text
      };
      await setDoc(doc(this.firestore, "Drivers", `${uid}/Documents/${name}`), { ...loc });
      return true;
    } catch (e) {
      // alert(e)
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
        cash: true,
        notificationID: '',
        time: ''
      };
      await setDoc(doc(this.firestore, "Riders", uid), { ...loc });
      return true;
    } catch (e) {
      return null;
    }
  }


  getDocs() {
    const userDocRef = collection(this.firestore, `Drivers/${this.auth.currentUser.uid}/Documents`);
    return collectionData(userDocRef);
  }

  async updateMessageInfo(uid) {
    return await updateDoc(doc(this.firestore, `Messages/${uid}`),
      {
        new: false
      }
    )
  }

  async PriceSave(name, amt) {
    return await addDoc(collection(this.firestore, `prices`), {
      name: name,
      amount: amt,
    });
  }


  async DocumentUpdate(name, amt, uid, s) {
    const userDocRef = doc(this.firestore, `Documents/${uid}`)
    return await updateDoc(userDocRef, {
      name: name,
      amount: amt,
      type: s,
      id: uid
    });
  }

  async CustomerBlock(value, uid) {
    return await updateDoc(doc(this.firestore, `Riders/${uid}`), {
      Block: value,
    });
  }


  async DriverBlock(value, uid) {
    return await updateDoc(doc(this.firestore, `Drivers/${uid}`), {
      Block: value,
    });
  }

  async UpdateDriverApprove(value, drivercheck, uid) {
    return await updateDoc(doc(this.firestore, `Drivers/${uid}`), {
      Approved: drivercheck,
      isApproved: value
    });
  }


  async DriverUpdateEarnings(amt, uid) {
    return await updateDoc(doc(this.firestore, `Drivers/${uid}`), {
      Earnings: amt,
    });
  }

  async updateDriverNumRides(numRides: number, uid: string) {
    return await updateDoc(doc(this.firestore, `Drivers/${uid}`), {
      Driver_num_rides: numRides,
    });
  }

  async DocumentSave(name, type, content, description) {
    return await addDoc(collection(this.firestore, `Documents`), {
      name: name,
      type: type,
      content: content,
      description: description,
      createdAt: serverTimestamp()
    });
  }

  async DocumentComponentUpdate(id, name, type, content, description) {
    const docRef = doc(this.firestore, `Documents/${id}`);
    return await updateDoc(docRef, {
      name: name,
      type: type,
      content: content,
      description: description
    });
  }

  async uploadFile(file: Blob, path: string): Promise<string> {
    const storageRef = ref(this.storage, path);
    const result = await uploadBytes(storageRef, file);
    return await getDownloadURL(result.ref);
  }


  async PriceUpdate(name, amt, uid) {
    const userDocRef = doc(this.firestore, `prices/${uid}`)
    return await updateDoc(userDocRef, {
      name: name,
      amount: amt,
      id: uid
    });
  }



  async CartypeSave(name, seats) {
    return await addDoc(collection(this.firestore, `Cartypes`), {
      name: name,
      seatNum: seats,
      //  surcharge: surcharge,
      //  mileage: mileage
    });
  }

  async checkCartypeNameExists(name: string, excludeId?: string): Promise<boolean> {
    const q = query(collection(this.firestore, 'Cartypes'), where('name', '==', name));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return false;
    }

    if (excludeId) {
      // If we are excluding an ID (updating), check if any of the found docs have a different ID
      return querySnapshot.docs.some(doc => doc.id !== excludeId);
    }

    return true;
  }

  async CartypeUpdate(uid, name, seats) {
    const userDocRef = doc(this.firestore, `Cartypes/${uid}`)
    return await updateDoc(userDocRef, {
      name: name,
      seatNum: seats,
      //  surcharge: surcharge,
      //  mileage: mileage
    });
  }


  async CartypeDelete(uid) {
    const userDocRef = doc(this.firestore, `Cartypes/${uid}`)
    await deleteDoc(userDocRef);
  }

  async DocumentDelete(uid) {
    const userDocRef = doc(this.firestore, `Documents/${uid}`)
    await deleteDoc(userDocRef);
  }

  async PriceDelete(uid) {
    const userDocRef = doc(this.firestore, `prices/${uid}`)
    await deleteDoc(userDocRef);
  }

  private async initializeDefaultData() {
    try {
      console.log('Checking for default data seeding...');

      // 1. Seed Roles
      const rolesRef = collection(this.firestore, 'Roles');
      const rolesSnap = await getDocs(query(rolesRef, limit(1)));
      if (rolesSnap.empty) {
        console.log('Seeding default Roles...');
        const defaultRoles = ['Admin', 'Support', 'Manager'];
        for (const role of defaultRoles) {
          await addDoc(rolesRef, { name: role });
        }
      }

      // 2. Seed Cartypes
      const cartypesRef = collection(this.firestore, 'Cartypes');
      const cartypesSnap = await getDocs(query(cartypesRef, limit(1)));
      if (cartypesSnap.empty) {
        console.log('Seeding default Cartypes...');
        const defaultCartypes = [
          { name: 'Economy', seatNum: 4, image: 'https://i.ibb.co/KDy365b/hatchback.png' },
          { name: 'Comfort', seatNum: 4, image: 'https://i.ibb.co/KDy365b/hatchback.png' },
          { name: 'SUV', seatNum: 6, image: 'https://i.ibb.co/KDy365b/hatchback.png' }
        ];
        for (const ct of defaultCartypes) {
          await addDoc(cartypesRef, ct);
        }
      }

      // 3. Seed Prices
      const pricesRef = collection(this.firestore, 'prices');
      const pricesSnap = await getDocs(query(pricesRef, limit(1)));
      if (pricesSnap.empty) {
        console.log('Seeding default Prices...');
        const defaultPrices = [
          { name: 'Base Fare', amount: 5 },
          { name: 'Price per KM', amount: 2.5 }
        ];
        for (const p of defaultPrices) {
          await addDoc(pricesRef, p);
        }
      }

      console.log('Default data seeding check complete.');
    } catch (error) {
      console.error('Error during default data seeding:', error);
    }
  }

  async createCard(name, number, type, id) {
    try {
      const loc: Card = {
        name: name,
        number: number,
        type: type,
        id: id,
        selected: true
      };
      await setDoc(doc(this.firestore, "Drivers", `${this.auth.currentUser.uid}/Cards/${name}`), { ...loc });
      return true;
    } catch (e) {
      alert(e)
      return null;
    }

  }

  async updateCArd(name, number, type, id, state) {
    try {
      const loc: Card = {
        name: name,
        number: number,
        type: type,
        id: id,
        selected: state
      };
      await updateDoc(doc(this.firestore, "Drivers", `${this.profile.Rider_id}/Cards/${name}`), { ...loc });
      return true;
    } catch (e) {
      alert(e)
      return null;
    }

  }


  async updateOnlineState(state) {
    try {
      const userDocRef = doc(this.firestore, 'Drivers', `/${this.auth.currentUser.uid}/`)
      await updateDoc(userDocRef, {
        onlineState: state,
      });
      return true;
    } catch (e) {
      alert(e)
      return null;
    }
  }


  async updateEarnings(value) {
    try {
      const userDocRef = doc(this.firestore, 'Drivers', `/${this.auth.currentUser.uid}/`)
      await updateDoc(userDocRef, {
        Earnings: value,
      });
      return true;
    } catch (e) {
      alert(e)
      return null;
    }
  }
}
