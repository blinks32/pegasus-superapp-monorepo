import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GeneralSettingsPageRoutingModule } from './general-settings-routing.module';

import { GeneralSettingsPage } from './general-settings.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GeneralSettingsPageRoutingModule
  ],
  declarations: [GeneralSettingsPage]
})
export class GeneralSettingsPageModule {}
