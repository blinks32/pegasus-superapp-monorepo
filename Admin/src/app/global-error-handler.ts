import { ErrorHandler, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const errorMsg = error.message || JSON.stringify(error);
    
    // Filter out Capacitor web platform errors
    if (this.isCapacitorWebError(errorMsg)) {
      console.warn('Capacitor web platform error (suppressed):', errorMsg);
      return;
    }
    
    // Force console log even if something is suppressing logs
    window['forceLog'] = function(msg) {
      var div = document.createElement('div');
      div.style.color = 'red';
      div.style.backgroundColor = 'white';
      div.style.padding = '10px';
      div.style.position = 'fixed';
      div.style.top = '10px';
      div.style.left = '10px';
      div.style.zIndex = '9999';
      div.innerHTML = msg;
      document.body.appendChild(div);
    };
    
    console.error('Global error handler caught error:', error);
    window['forceLog']('ERROR: ' + errorMsg);
    
    // Try to log to an element on the page
    try {
      // Add a visible error message to the body
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'red';
      errorDiv.style.backgroundColor = 'white';
      errorDiv.style.padding = '20px';
      errorDiv.style.margin = '20px';
      errorDiv.style.border = '1px solid red';
      errorDiv.innerHTML = `<h3>Application Error</h3><p>${errorMsg}</p>`;
      document.body.appendChild(errorDiv);
    } catch (e) {
      console.error('Failed to add error to DOM', e);
    }
  }

  private isCapacitorWebError(errorMsg: string): boolean {
    const capacitorWebErrors = [
      'plugin is not implemented on web',
      'StatusBar" plugin is not implemented on web',
      'SplashScreen" plugin is not implemented on web',
      'Camera" plugin is not implemented on web',
      'Geolocation" plugin is not implemented on web',
      'Network" plugin is not implemented on web'
    ];
    
    return capacitorWebErrors.some(error => 
      errorMsg.toLowerCase().includes(error.toLowerCase())
    );
  }
} 