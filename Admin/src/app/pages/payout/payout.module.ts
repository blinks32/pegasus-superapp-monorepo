import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { PayoutPageRoutingModule } from './payout-routing.module';
import { PayoutPage } from './payout.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PayoutPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [PayoutPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PayoutPageModule { }
