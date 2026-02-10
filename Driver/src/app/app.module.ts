import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { environment } from '../environments/environment';
import { provideAuth, getAuth, FacebookAuthProvider, GoogleAuthProvider} from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { Capacitor } from '@capacitor/core';
import { indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { OtpComponent } from './otp/otp.component';
import { NgOtpInputModule } from  'ng-otp-input';
import { Client} from "@googlemaps/google-maps-services-js";
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { CountrySearchModalComponent } from './country-search-modal/country-search-modal.component';
import { EnrouteChatComponent } from './enroute-chat/enroute-chat.component';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './services/language.service';
import { TripSummaryComponent } from './trip-summary/trip-summary.component';
// AoT requires an exported function for factories
export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [AppComponent, OtpComponent, CountrySearchModalComponent, EnrouteChatComponent, TripSummaryComponent],
  entryComponents: [TripSummaryComponent, CountrySearchModalComponent, EnrouteChatComponent],
  imports: [
    BrowserModule,
    NgOtpInputModule,
    FormsModule,
    CommonModule,
    HttpClientModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      if (Capacitor.isNativePlatform()) {
        return initializeAuth(getApp(), {
          persistence: indexedDBLocalPersistence,
        });
      } else {
        return getAuth();
      }
    }),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    })
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },  GoogleAuthProvider, FacebookAuthProvider, Client, LanguageService],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(translate: TranslateService) {
    translate.setDefaultLang('en');
    
    // Get saved language or use browser language
    const savedLang = localStorage.getItem('preferred_language');
    const browserLang = translate.getBrowserLang();
    const defaultLang = savedLang || (browserLang?.match(/en|ar/) ? browserLang : 'en');
    
    translate.use(defaultLang);
    document.documentElement.dir = defaultLang === 'ar' ? 'rtl' : 'ltr';
  }
}
