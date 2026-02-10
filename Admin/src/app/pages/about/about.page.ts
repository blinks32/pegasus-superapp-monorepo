import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
})
export class AboutPage implements OnInit {

  constructor(
    private nav: NavController,
    private translate: TranslateService
  ) { }

  ngOnInit() {
  }

  goBack(){
    this.nav.pop();
  }

  changeLanguage(lang: string) {
    this.translate.use(lang);
  }

}
