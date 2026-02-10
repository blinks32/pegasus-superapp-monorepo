import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { PaymentcallbackPageRoutingModule } from './paymentcallback-routing.module';

import { PaymentcallbackPage } from './paymentcallback.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PaymentcallbackPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [PaymentcallbackPage]
})
export class PaymentcallbackPageModule {}
