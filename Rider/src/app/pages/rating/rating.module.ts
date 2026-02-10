import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { RatingPageRoutingModule } from './rating-routing.module';

import { RatingPage } from './rating.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RatingPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [RatingPage]
})
export class RatingPageModule {}
