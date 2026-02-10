import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit, getDocs, addDoc, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { Wallet, WalletTransaction, ReferralInfo, ReferralReward } from '../interfaces/wallet';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private walletSubject = new BehaviorSubject<Wallet | null>(null);
  public wallet$ = this.walletSubject.asObservable();
  
  private transactionsSubject = new BehaviorSubject<WalletTransaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {
    this.initializeWalletListener();
  }

  private initializeWalletListener() {
    this.auth.onAuthStateChanged(user => {
      if (user) {
        this.subscribeToWallet(user.uid);
        this.subscribeToTransactions(user.uid);
      }
    });
  }

  private subscribeToWallet(userId: string) {
    const walletRef = doc(this.firestore, 'Wallets', userId);
    onSnapshot(walletRef, (snapshot) => {
      if (snapshot.exists()) {
        this.walletSubject.next(snapshot.data() as Wallet);
      } else {
        this.createWallet(userId);
      }
    });
  }

  private subscribeToTransactions(userId: string) {
    const transactionsQuery = query(
      collection(this.firestore, 'WalletTransactions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    onSnapshot(transactionsQuery, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        transactionId: doc.id,
        ...doc.data()
      })) as WalletTransaction[];
      this.transactionsSubject.next(transactions);
    });
  }

  async createWallet(userId: string): Promise<Wallet> {
    const wallet: Wallet = {
      userId,
      balance: 0,
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await setDoc(doc(this.firestore, 'Wallets', userId), wallet);
    this.walletSubject.next(wallet);
    return wallet;
  }

  async getWallet(): Promise<Wallet | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    
    const walletRef = doc(this.firestore, 'Wallets', user.uid);
    const walletSnap = await getDoc(walletRef);
    
    if (walletSnap.exists()) {
      return walletSnap.data() as Wallet;
    }
    return this.createWallet(user.uid);
  }

  async getBalance(): Promise<number> {
    const wallet = await this.getWallet();
    return wallet?.balance || 0;
  }

  async addFunds(amount: number, paymentMethodId: string, description: string = 'Wallet top-up'): Promise<WalletTransaction> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const transaction: Omit<WalletTransaction, 'transactionId'> = {
      walletId: user.uid,
      userId: user.uid,
      type: 'topup',
      amount,
      currency: 'USD',
      description,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
      metadata: { paymentMethodId }
    };
    
    const docRef = await addDoc(collection(this.firestore, 'WalletTransactions'), transaction);
    
    // Update wallet balance
    const walletRef = doc(this.firestore, 'Wallets', user.uid);
    const wallet = await this.getWallet();
    await updateDoc(walletRef, {
      balance: (wallet?.balance || 0) + amount,
      updatedAt: new Date()
    });
    
    return { transactionId: docRef.id, ...transaction };
  }

  async deductFunds(amount: number, description: string, rideId?: string): Promise<WalletTransaction | null> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const wallet = await this.getWallet();
    if (!wallet || wallet.balance < amount) {
      return null; // Insufficient funds
    }
    
    const transaction: Omit<WalletTransaction, 'transactionId'> = {
      walletId: user.uid,
      userId: user.uid,
      type: 'ride_payment',
      amount: -amount,
      currency: 'USD',
      description,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
      metadata: { rideId }
    };
    
    const docRef = await addDoc(collection(this.firestore, 'WalletTransactions'), transaction);
    
    // Update wallet balance
    const walletRef = doc(this.firestore, 'Wallets', user.uid);
    await updateDoc(walletRef, {
      balance: wallet.balance - amount,
      updatedAt: new Date()
    });
    
    return { transactionId: docRef.id, ...transaction };
  }

  async addCashback(amount: number, rideId: string, description: string = 'Ride cashback'): Promise<WalletTransaction> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const transaction: Omit<WalletTransaction, 'transactionId'> = {
      walletId: user.uid,
      userId: user.uid,
      type: 'cashback',
      amount,
      currency: 'USD',
      description,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
      metadata: { rideId }
    };
    
    const docRef = await addDoc(collection(this.firestore, 'WalletTransactions'), transaction);
    
    // Update wallet balance
    const walletRef = doc(this.firestore, 'Wallets', user.uid);
    const wallet = await this.getWallet();
    await updateDoc(walletRef, {
      balance: (wallet?.balance || 0) + amount,
      updatedAt: new Date()
    });
    
    return { transactionId: docRef.id, ...transaction };
  }

  // Referral System
  async generateReferralCode(): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Check if user already has a referral code
    const existingRef = await getDoc(doc(this.firestore, 'Referrals', user.uid));
    if (existingRef.exists()) {
      return (existingRef.data() as ReferralInfo).referralCode;
    }
    
    // Generate unique code
    const code = this.generateUniqueCode(user.uid);
    
    const referralInfo: ReferralInfo = {
      referralCode: code,
      userId: user.uid,
      referredUsers: [],
      totalEarnings: 0,
      pendingEarnings: 0,
      createdAt: new Date()
    };
    
    await setDoc(doc(this.firestore, 'Referrals', user.uid), referralInfo);
    return code;
  }

  private generateUniqueCode(userId: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code + userId.substring(0, 4).toUpperCase();
  }

  async applyReferralCode(code: string): Promise<{ success: boolean; message: string }> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Find referrer by code
    const referralsQuery = query(
      collection(this.firestore, 'Referrals'),
      where('referralCode', '==', code.toUpperCase())
    );
    
    const snapshot = await getDocs(referralsQuery);
    if (snapshot.empty) {
      return { success: false, message: 'Invalid referral code' };
    }
    
    const referrerData = snapshot.docs[0].data() as ReferralInfo;
    
    // Check if user is trying to use their own code
    if (referrerData.userId === user.uid) {
      return { success: false, message: 'You cannot use your own referral code' };
    }
    
    // Check if user has already been referred
    const userRef = doc(this.firestore, 'Users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data()['referredBy']) {
      return { success: false, message: 'You have already used a referral code' };
    }
    
    // Apply referral
    const referralReward: ReferralReward = {
      referrerId: referrerData.userId,
      referredUserId: user.uid,
      referrerReward: 5, // $5 for referrer
      referredReward: 3, // $3 for new user
      status: 'pending',
      createdAt: new Date()
    };
    
    await addDoc(collection(this.firestore, 'ReferralRewards'), referralReward);
    
    // Update user's referredBy field
    await updateDoc(userRef, { referredBy: referrerData.userId });
    
    // Add credit to new user's wallet
    await this.addReferralCredit(3, 'Welcome bonus from referral');
    
    return { success: true, message: 'Referral code applied! $3 added to your wallet.' };
  }

  async addReferralCredit(amount: number, description: string): Promise<WalletTransaction> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const transaction: Omit<WalletTransaction, 'transactionId'> = {
      walletId: user.uid,
      userId: user.uid,
      type: 'referral',
      amount,
      currency: 'USD',
      description,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date()
    };
    
    const docRef = await addDoc(collection(this.firestore, 'WalletTransactions'), transaction);
    
    // Update wallet balance
    const walletRef = doc(this.firestore, 'Wallets', user.uid);
    const wallet = await this.getWallet();
    await updateDoc(walletRef, {
      balance: (wallet?.balance || 0) + amount,
      updatedAt: new Date()
    });
    
    return { transactionId: docRef.id, ...transaction };
  }

  async getReferralInfo(): Promise<ReferralInfo | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    
    const refSnap = await getDoc(doc(this.firestore, 'Referrals', user.uid));
    if (refSnap.exists()) {
      return refSnap.data() as ReferralInfo;
    }
    return null;
  }

  async getTransactionHistory(limitCount: number = 50): Promise<WalletTransaction[]> {
    const user = this.auth.currentUser;
    if (!user) return [];
    
    const transactionsQuery = query(
      collection(this.firestore, 'WalletTransactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(transactionsQuery);
    return snapshot.docs.map(doc => ({
      transactionId: doc.id,
      ...doc.data()
    })) as WalletTransaction[];
  }
}
