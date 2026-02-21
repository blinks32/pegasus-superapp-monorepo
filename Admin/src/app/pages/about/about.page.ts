import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, TranslateModule]
})
export class AboutPage implements OnInit {

  constructor(
    private nav: NavController,
    private translate: TranslateService
  ) { }

  ngOnInit() {
  }

  goBack() {
    this.nav.pop();
  }

  changeLanguage(lang: string) {
    this.translate.use(lang);
  }

}
