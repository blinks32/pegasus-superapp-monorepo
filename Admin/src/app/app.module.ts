import { NgModule, ErrorHandler, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { environment } from '../environments/environment';
import { provideAuth, getAuth, FacebookAuthProvider, GoogleAuthProvider } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { Capacitor } from '@capacitor/core';
import { indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { Client } from "@googlemaps/google-maps-services-js";
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AlertController } from '@ionic/angular';
import { GlobalErrorHandler } from './global-error-handler';
import { ComponentsModule } from './components.module';

import { NgOtpInputModule } from 'ng-otp-input';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    NgOtpInputModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    ComponentsModule,
    AppComponent,
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    BrowserAnimationsModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    GoogleAuthProvider,
    FacebookAuthProvider,
    Client,
    AlertController,
    provideFirebaseApp(() => {
      try {
        console.log('Initializing Firebase with config:', environment.firebase);
        return initializeApp(environment.firebase);
      } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
      }
    }),
    provideAuth(() => {
      try {
        if (Capacitor.isNativePlatform()) {
          console.log('Initializing Auth for native platform');
          return initializeAuth(getApp(), {
            persistence: indexedDBLocalPersistence,
          });
        } else {
          console.log('Initializing Auth for web platform');
          return getAuth();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        throw error;
      }
    }),
    provideFirestore(() => {
      try {
        console.log('Initializing Firestore');
        return getFirestore();
      } catch (error) {
        console.error('Firestore initialization error:', error);
        throw error;
      }
    }),
    provideStorage(() => {
      try {
        console.log('Initializing Storage');
        return getStorage();
      } catch (error) {
        console.error('Storage initialization error:', error);
        throw error;
      }
    }),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(translate: TranslateService) {
    translate.setDefaultLang('en');
    const savedLang = localStorage.getItem('preferred_language') || 'en';
    translate.use(savedLang);
  }
}
