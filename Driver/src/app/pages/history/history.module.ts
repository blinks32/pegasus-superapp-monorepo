import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HistoryPageRoutingModule } from './history-routing.module';
import { HistoryPage } from './history.page';
import { SharedTranslationsModule } from '../../shared/shared-translations.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HistoryPageRoutingModule,
    SharedTranslationsModule
  ],
  declarations: [HistoryPage]
})
export class HistoryPageModule {}
