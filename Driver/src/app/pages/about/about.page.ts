import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
})
export class AboutPage implements OnInit {
  currentLanguage: string = 'en';

  constructor(
    private nav: NavController,
    private translate: TranslateService
  ) {
    this.currentLanguage = this.translate.currentLang || 'en';
  }

  ngOnInit() {
  }

  goBack(){
    this.nav.pop();
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
    this.translate.use(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('preferred_language', lang);
  }
}
