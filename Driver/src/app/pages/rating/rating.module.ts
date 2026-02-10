import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RatingPageRoutingModule } from './rating-routing.module';
import { RatingPage } from './rating.page';
import { SharedTranslationsModule } from '../../shared/shared-translations.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RatingPageRoutingModule,
    SharedTranslationsModule
  ],
  declarations: [RatingPage]
})
export class RatingPageModule {}
