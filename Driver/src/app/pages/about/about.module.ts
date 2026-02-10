import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AboutPageRoutingModule } from './about-routing.module';
import { AboutPage } from './about.page';
import { SharedTranslationsModule } from '../../shared/shared-translations.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AboutPageRoutingModule,
    SharedTranslationsModule
  ],
  declarations: [AboutPage]
})
export class AboutPageModule {}
