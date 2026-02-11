import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DriversPageRoutingModule } from './drivers-routing.module';
import { DriversPage } from './drivers.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DriversPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [DriversPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DriversPageModule { }
