import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DetailsPageRoutingModule } from './details-routing.module';
import { DetailsPage } from './details.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    DetailsPageRoutingModule,
    TranslateModule.forChild()
  ],
  declarations: [DetailsPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DetailsPageModule {}
