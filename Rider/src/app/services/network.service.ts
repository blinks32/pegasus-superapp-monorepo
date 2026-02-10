// src/app/services/network.service.ts

import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private networkStatus = new BehaviorSubject<boolean>(true);
  networkStatus$ = this.networkStatus.asObservable();

  constructor() {
    this.initializeNetworkListener();
  }

  private initializeNetworkListener() {
    try {
      Network.addListener('networkStatusChange', status => {
        console.log('Network status changed', status);
        this.networkStatus.next(status.connected);

        if (status.connected) {
          this.handleReconnect();
        } else {
          this.handleDisconnect();
        }
      });
    } catch (error) {
      console.warn('Failed to add network listener:', error);
    }

    this.checkInitialNetworkStatus();
  }

  private async checkInitialNetworkStatus() {
    try {
      const status = await Network.getStatus();
      console.log('Initial network status:', status);
      this.networkStatus.next(status.connected);
      if (!status.connected) {
        this.handleDisconnect();
      }
    } catch (error) {
      console.warn('Network status check failed, performing fallback check:', error);
      // Fallback: try to make a simple network request with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        await fetch('https://www.google.com/favicon.ico', { 
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        this.networkStatus.next(true);
        console.log('Fallback network check: connected');
      } catch (fetchError) {
        console.warn('Fallback network check failed:', fetchError);
        // Be more conservative - assume connected if we can't determine
        this.networkStatus.next(true);
        console.log('Network status uncertain, assuming connected');
      }
    }
  }

  private handleDisconnect() {
    console.log('Disconnected from network');
    // Handle the UI or logic when the network is disconnected
  }

  private handleReconnect() {
    console.log('Reconnected to network');
    // Handle the UI or logic when the network is reconnected
  }

  isConnected(): boolean {
    return this.networkStatus.value;
  }
}
