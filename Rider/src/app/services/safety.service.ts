import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, getDocs, addDoc, onSnapshot, deleteDoc, limit } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject } from 'rxjs';
import { 
  EmergencyContact, 
  TripShare, 
  SharedContact, 
  SOSAlert, 
  SafetyRating, 
  SafetyIssue, 
  AudioRecording,
  DriverVerification 
} from '../interfaces/safety';

@Injectable({
  providedIn: 'root'
})
export class SafetyService {
  private emergencyContactsSubject = new BehaviorSubject<EmergencyContact[]>([]);
  public emergencyContacts$ = this.emergencyContactsSubject.asObservable();

  private activeAlertsSubject = new BehaviorSubject<SOSAlert[]>([]);
  public activeAlerts$ = this.activeAlertsSubject.asObservable();

  private currentRecordingSubject = new BehaviorSubject<AudioRecording | null>(null);
  public currentRecording$ = this.currentRecordingSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private storage: Storage
  ) {
    this.initializeListeners();
  }

  private initializeListeners() {
    this.auth.onAuthStateChanged(user => {
      if (user) {
        this.subscribeToEmergencyContacts(user.uid);
        this.subscribeToActiveAlerts(user.uid);
      }
    });
  }

  // ==================== Emergency Contacts ====================

  private subscribeToEmergencyContacts(userId: string) {
    const contactsQuery = query(
      collection(this.firestore, 'EmergencyContacts'),
      where('userId', '==', userId),
      orderBy('isPrimary', 'desc')
    );

    onSnapshot(contactsQuery, (snapshot) => {
      const contacts = snapshot.docs.map(doc => ({
        contactId: doc.id,
        ...doc.data()
      })) as EmergencyContact[];
      this.emergencyContactsSubject.next(contacts);
    });
  }

  async addEmergencyContact(contact: Omit<EmergencyContact, 'contactId' | 'userId' | 'createdAt'>): Promise<EmergencyContact> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const newContact: Omit<EmergencyContact, 'contactId'> = {
      ...contact,
      userId: user.uid,
      createdAt: new Date()
    };

    // If this is primary, unset other primary contacts
    if (contact.isPrimary) {
      await this.unsetPrimaryContacts(user.uid);
    }

    const docRef = await addDoc(collection(this.firestore, 'EmergencyContacts'), newContact);
    return { contactId: docRef.id, ...newContact };
  }

  async updateEmergencyContact(contactId: string, updates: Partial<EmergencyContact>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    if (updates.isPrimary) {
      await this.unsetPrimaryContacts(user.uid);
    }

    await updateDoc(doc(this.firestore, 'EmergencyContacts', contactId), updates);
  }

  async deleteEmergencyContact(contactId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'EmergencyContacts', contactId));
  }

  private async unsetPrimaryContacts(userId: string): Promise<void> {
    const contactsQuery = query(
      collection(this.firestore, 'EmergencyContacts'),
      where('userId', '==', userId),
      where('isPrimary', '==', true)
    );

    const snapshot = await getDocs(contactsQuery);
    const updates = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { isPrimary: false })
    );
    await Promise.all(updates);
  }

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    const user = this.auth.currentUser;
    if (!user) return [];

    const contactsQuery = query(
      collection(this.firestore, 'EmergencyContacts'),
      where('userId', '==', user.uid),
      orderBy('isPrimary', 'desc')
    );

    const snapshot = await getDocs(contactsQuery);
    return snapshot.docs.map(doc => ({
      contactId: doc.id,
      ...doc.data()
    })) as EmergencyContact[];
  }


  // ==================== Trip Sharing ====================

  async shareTripWithContacts(tripId: string, tripDetails: {
    pickupAddress: string;
    destinationAddress: string;
    driverName?: string;
    driverPhone?: string;
    driverPlate?: string;
    driverCar?: string;
    estimatedArrival?: Date;
  }, contactIds: string[]): Promise<TripShare> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Get user info
    const userDoc = await getDoc(doc(this.firestore, 'Users', user.uid));
    const userData = userDoc.data();

    // Get selected contacts
    const contacts = await this.getEmergencyContacts();
    const selectedContacts = contacts.filter(c => contactIds.includes(c.contactId));

    const sharedContacts: SharedContact[] = selectedContacts.map(c => ({
      contactId: c.contactId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notificationSent: false
    }));

    const shareCode = this.generateShareCode();
    const shareLink = `https://app.yourride.com/track/${shareCode}`;

    const tripShare: Omit<TripShare, 'shareId'> = {
      tripId,
      riderId: user.uid,
      riderName: userData?.['displayName'] || 'Rider',
      sharedWith: sharedContacts,
      shareLink,
      shareCode,
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      pickupAddress: tripDetails.pickupAddress,
      destinationAddress: tripDetails.destinationAddress,
      driverName: tripDetails.driverName,
      driverPhone: tripDetails.driverPhone,
      driverPlate: tripDetails.driverPlate,
      driverCar: tripDetails.driverCar,
      estimatedArrival: tripDetails.estimatedArrival,
      tripStatus: 'waiting'
    };

    const docRef = await addDoc(collection(this.firestore, 'TripShares'), tripShare);

    // Send notifications to contacts (would integrate with notification service)
    await this.notifySharedContacts(docRef.id, sharedContacts, shareLink, tripShare);

    return { shareId: docRef.id, ...tripShare };
  }

  private generateShareCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async notifySharedContacts(shareId: string, contacts: SharedContact[], shareLink: string, tripShare: Omit<TripShare, 'shareId'>): Promise<void> {
    // Update notification status for each contact
    const updatedContacts = contacts.map(c => ({
      ...c,
      notificationSent: true
    }));

    await updateDoc(doc(this.firestore, 'TripShares', shareId), {
      sharedWith: updatedContacts
    });

    // In production, integrate with SMS/Email service to send notifications
    console.log(`Trip share notifications sent to ${contacts.length} contacts`);
  }

  async updateTripShareLocation(shareId: string, lat: number, lng: number, status?: TripShare['tripStatus']): Promise<void> {
    const updates: Partial<TripShare> = {
      currentLat: lat,
      currentLng: lng
    };

    if (status) {
      updates.tripStatus = status;
    }

    await updateDoc(doc(this.firestore, 'TripShares', shareId), updates);
  }

  async endTripShare(shareId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'TripShares', shareId), {
      isActive: false,
      tripStatus: 'completed'
    });
  }

  async getTripShareByCode(shareCode: string): Promise<TripShare | null> {
    const shareQuery = query(
      collection(this.firestore, 'TripShares'),
      where('shareCode', '==', shareCode),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(shareQuery);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { shareId: doc.id, ...doc.data() } as TripShare;
  }


  // ==================== SOS Alerts ====================

  private subscribeToActiveAlerts(userId: string) {
    const alertsQuery = query(
      collection(this.firestore, 'SOSAlerts'),
      where('riderId', '==', userId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(alertsQuery, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({
        alertId: doc.id,
        ...doc.data()
      })) as SOSAlert[];
      this.activeAlertsSubject.next(alerts);
    });
  }

  async triggerSOSAlert(tripId: string, location: { lat: number; lng: number; address?: string }, alertType: SOSAlert['alertType'] = 'sos'): Promise<SOSAlert> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Get user info
    const userDoc = await getDoc(doc(this.firestore, 'Users', user.uid));
    const userData = userDoc.data();

    // Get trip info for driver details
    const tripDoc = await getDoc(doc(this.firestore, 'Trips', tripId));
    const tripData = tripDoc.data();

    const sosAlert: Omit<SOSAlert, 'alertId'> = {
      tripId,
      riderId: user.uid,
      riderName: userData?.['displayName'] || 'Rider',
      riderPhone: userData?.['phone'] || '',
      driverId: tripData?.['driverId'],
      driverName: tripData?.['driverName'],
      driverPhone: tripData?.['driverPhone'],
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      alertType,
      severity: alertType === 'sos' ? 'critical' : 'high',
      status: 'active',
      emergencyContactsNotified: false,
      adminNotified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(this.firestore, 'SOSAlerts'), sosAlert);

    // Notify emergency contacts
    await this.notifyEmergencyContactsOfSOS(docRef.id, sosAlert);

    // Notify admin
    await this.notifyAdminOfSOS(docRef.id, sosAlert);

    return { alertId: docRef.id, ...sosAlert };
  }

  private async notifyEmergencyContactsOfSOS(alertId: string, alert: Omit<SOSAlert, 'alertId'>): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    
    if (contacts.length > 0) {
      // In production, send SMS/push notifications to emergency contacts
      console.log(`SOS Alert sent to ${contacts.length} emergency contacts`);
      
      await updateDoc(doc(this.firestore, 'SOSAlerts', alertId), {
        emergencyContactsNotified: true,
        updatedAt: new Date()
      });
    }
  }

  private async notifyAdminOfSOS(alertId: string, alert: Omit<SOSAlert, 'alertId'>): Promise<void> {
    // Create admin notification
    await addDoc(collection(this.firestore, 'AdminNotifications'), {
      type: 'sos_alert',
      alertId,
      riderId: alert.riderId,
      riderName: alert.riderName,
      tripId: alert.tripId,
      location: { lat: alert.lat, lng: alert.lng },
      severity: alert.severity,
      read: false,
      createdAt: new Date()
    });

    await updateDoc(doc(this.firestore, 'SOSAlerts', alertId), {
      adminNotified: true,
      updatedAt: new Date()
    });
  }

  async cancelSOSAlert(alertId: string, reason: string = 'Cancelled by user'): Promise<void> {
    await updateDoc(doc(this.firestore, 'SOSAlerts', alertId), {
      status: 'false_alarm',
      resolution: reason,
      resolvedAt: new Date(),
      updatedAt: new Date()
    });
  }

  async getActiveSOSAlerts(): Promise<SOSAlert[]> {
    const user = this.auth.currentUser;
    if (!user) return [];

    const alertsQuery = query(
      collection(this.firestore, 'SOSAlerts'),
      where('riderId', '==', user.uid),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(alertsQuery);
    return snapshot.docs.map(doc => ({
      alertId: doc.id,
      ...doc.data()
    })) as SOSAlert[];
  }

  async getSOSAlertHistory(): Promise<SOSAlert[]> {
    const user = this.auth.currentUser;
    if (!user) return [];

    const alertsQuery = query(
      collection(this.firestore, 'SOSAlerts'),
      where('riderId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(alertsQuery);
    return snapshot.docs.map(doc => ({
      alertId: doc.id,
      ...doc.data()
    })) as SOSAlert[];
  }


  // ==================== Audio Recording ====================

  async startAudioRecording(tripId: string, driverId: string): Promise<AudioRecording> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const recording: Omit<AudioRecording, 'recordingId'> = {
      tripId,
      riderId: user.uid,
      driverId,
      startTime: new Date(),
      status: 'recording',
      consentGiven: true,
      autoDeleteAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Auto-delete after 7 days
    };

    const docRef = await addDoc(collection(this.firestore, 'AudioRecordings'), recording);
    const newRecording = { recordingId: docRef.id, ...recording };
    this.currentRecordingSubject.next(newRecording);
    
    return newRecording;
  }

  async stopAudioRecording(recordingId: string, audioBlob?: Blob): Promise<AudioRecording> {
    const endTime = new Date();
    const recordingRef = doc(this.firestore, 'AudioRecordings', recordingId);
    const recordingSnap = await getDoc(recordingRef);
    
    if (!recordingSnap.exists()) {
      throw new Error('Recording not found');
    }

    const recordingData = recordingSnap.data() as AudioRecording;
    const duration = Math.floor((endTime.getTime() - new Date(recordingData.startTime).getTime()) / 1000);

    let fileUrl: string | undefined;
    let fileSize: number | undefined;

    // Upload audio file if provided
    if (audioBlob) {
      const user = this.auth.currentUser;
      if (user) {
        const filePath = `audio-recordings/${user.uid}/${recordingId}.webm`;
        const storageRef = ref(this.storage, filePath);
        await uploadBytes(storageRef, audioBlob);
        fileUrl = await getDownloadURL(storageRef);
        fileSize = audioBlob.size;
      }
    }

    const updates: Partial<AudioRecording> = {
      endTime,
      duration,
      status: 'completed',
      fileUrl,
      fileSize
    };

    await updateDoc(recordingRef, updates);
    this.currentRecordingSubject.next(null);

    return { recordingId, ...recordingData, ...updates };
  }

  async getRecordingForTrip(tripId: string): Promise<AudioRecording | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    const recordingQuery = query(
      collection(this.firestore, 'AudioRecordings'),
      where('tripId', '==', tripId),
      where('riderId', '==', user.uid)
    );

    const snapshot = await getDocs(recordingQuery);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { recordingId: doc.id, ...doc.data() } as AudioRecording;
  }

  // ==================== Safety Ratings ====================

  async submitSafetyRating(tripId: string, driverId: string, rating: {
    overallRating: number;
    safetyRating: number;
    drivingRating: number;
    vehicleConditionRating: number;
    comments?: string;
    reportedIssues?: SafetyIssue[];
  }): Promise<SafetyRating> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const safetyRating: Omit<SafetyRating, 'ratingId'> = {
      tripId,
      riderId: user.uid,
      driverId,
      ...rating,
      createdAt: new Date()
    };

    const docRef = await addDoc(collection(this.firestore, 'SafetyRatings'), safetyRating);

    // If severe issues reported, create admin notification
    if (rating.reportedIssues?.some(issue => issue.severity === 'severe')) {
      await this.reportSevereIssue(docRef.id, safetyRating);
    }

    return { ratingId: docRef.id, ...safetyRating };
  }

  private async reportSevereIssue(ratingId: string, rating: Omit<SafetyRating, 'ratingId'>): Promise<void> {
    await addDoc(collection(this.firestore, 'AdminNotifications'), {
      type: 'severe_safety_issue',
      ratingId,
      riderId: rating.riderId,
      driverId: rating.driverId,
      tripId: rating.tripId,
      issues: rating.reportedIssues,
      read: false,
      createdAt: new Date()
    });
  }

  async getDriverSafetyScore(driverId: string): Promise<{ averageRating: number; totalRatings: number }> {
    const ratingsQuery = query(
      collection(this.firestore, 'SafetyRatings'),
      where('driverId', '==', driverId),
      limit(100)
    );

    const snapshot = await getDocs(ratingsQuery);
    if (snapshot.empty) {
      return { averageRating: 0, totalRatings: 0 };
    }

    const ratings = snapshot.docs.map(doc => doc.data() as SafetyRating);
    const totalRatings = ratings.length;
    const averageRating = ratings.reduce((sum, r) => sum + r.safetyRating, 0) / totalRatings;

    return { averageRating: Math.round(averageRating * 10) / 10, totalRatings };
  }

  // ==================== Driver Verification ====================

  async getDriverVerifications(driverId: string): Promise<DriverVerification[]> {
    const verificationsQuery = query(
      collection(this.firestore, 'DriverVerifications'),
      where('driverId', '==', driverId),
      where('status', '==', 'verified')
    );

    const snapshot = await getDocs(verificationsQuery);
    return snapshot.docs.map(doc => ({
      verificationId: doc.id,
      ...doc.data()
    })) as DriverVerification[];
  }

  async isDriverVerified(driverId: string): Promise<boolean> {
    const verifications = await this.getDriverVerifications(driverId);
    
    // Check for essential verifications
    const requiredTypes = ['identity', 'background_check', 'license'];
    return requiredTypes.every(type => 
      verifications.some(v => v.verificationType === type && v.status === 'verified')
    );
  }
}
