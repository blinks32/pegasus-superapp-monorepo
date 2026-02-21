import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GeneralSettingsPageRoutingModule } from './general-settings-routing.module';

import { GeneralSettingsPage } from './general-settings.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GeneralSettingsPageRoutingModule,
    TranslateModule.forChild(),
    GeneralSettingsPage
  ]
})
export class GeneralSettingsPageModule { }
