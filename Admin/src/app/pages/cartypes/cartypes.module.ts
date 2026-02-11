import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CartypesPageRoutingModule } from './cartypes-routing.module';

import { CartypesPage } from './cartypes.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CartypesPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [CartypesPage]
})
export class CartypesPageModule { }
