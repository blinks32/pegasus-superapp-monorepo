import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { IonicModule } from '@ionic/angular';

import { SupportPageRoutingModule } from './support-routing.module';
import { SupportPage } from './support.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SupportPageRoutingModule,
    SupportPage
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SupportPageModule { }
