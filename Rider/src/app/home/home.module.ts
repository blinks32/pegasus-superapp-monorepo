import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { HomePageRoutingModule } from './home-routing.module';
import { SharedRidePromptComponent } from '../shared-ride-prompt/shared-ride-prompt.component';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    TranslateModule.forChild()
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  declarations: [HomePage, SharedRidePromptComponent]
    //NearbyTripsComponent]
})
export class HomePageModule {}
