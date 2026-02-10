import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HistoryPageRoutingModule } from './history-routing.module';
import { HistoryPage } from './history.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HistoryPageRoutingModule
  ],
  declarations: [HistoryPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HistoryPageModule {}
