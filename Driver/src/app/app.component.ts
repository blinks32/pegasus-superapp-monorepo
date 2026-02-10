import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private translate: TranslateService
  ) {
    this.initializeApp();
  }

  initializeApp() {
    const savedLang = localStorage.getItem('preferred_language') || 'en';
    this.translate.setDefaultLang('en');
    this.translate.use(savedLang);
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
  }
}
