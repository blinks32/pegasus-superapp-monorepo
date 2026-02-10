import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NetworkPageRoutingModule } from './network-routing.module';
import { NetworkPage } from './network.page';
import { SharedTranslationsModule } from '../../shared/shared-translations.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NetworkPageRoutingModule,
    SharedTranslationsModule
  ],
  declarations: [NetworkPage]
})
export class NetworkPageModule {}
