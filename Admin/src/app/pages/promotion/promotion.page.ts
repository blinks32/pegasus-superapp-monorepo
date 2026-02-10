import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-promotion',
  templateUrl: './promotion.page.html',
  styleUrls: ['./promotion.page.scss'],
})
export class PromotionPage implements OnInit {

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
