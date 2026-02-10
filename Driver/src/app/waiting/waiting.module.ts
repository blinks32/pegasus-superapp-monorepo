import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { WaitingPageRoutingModule } from './waiting-routing.module';
import { WaitingPage } from './waiting.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WaitingPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [WaitingPage]
})
export class WaitingPageModule {}
