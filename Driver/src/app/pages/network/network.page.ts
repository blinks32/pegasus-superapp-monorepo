import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-network',
  templateUrl: './network.page.html',
  styleUrls: ['./network.page.scss'],
})
export class NetworkPage implements OnInit {
  approve: boolean;
  isConnected: boolean;
  private networkStatus$ = new BehaviorSubject<boolean>(true);
  currentLanguage: string = 'en';

  constructor(
    private router: Router,
    private translate: TranslateService
  ) {
    this.currentLanguage = this.translate.currentLang || 'en';
  }

  ngOnInit() {
  }

  async CheckNetwork(){
    await this.monitorNetwork();
  }  

  async monitorNetwork() {
    this.approve = true;
    const status = await Network.getStatus();
    this.isConnected = status.connected;
    this.networkStatus$.next(this.isConnected);
    console.log("Monitor Network Called..");

    Network.addListener('networkStatusChange', async (status) => {
      console.log("Monitoring Network........");
      this.isConnected = status.connected;
      this.networkStatus$.next(this.isConnected);
    });

    this.networkStatus$.subscribe((isConnected) => {
      if (isConnected) {
        this.approve = false;
        this.router.navigate(['tabs']);
      } else {
        this.approve = false;
      }
    });
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
    this.translate.use(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('preferred_language', lang);
  }
}
