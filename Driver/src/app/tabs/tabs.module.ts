import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TabsPageRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';
import { SharedTranslationsModule } from '../shared/shared-translations.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    TabsPageRoutingModule,
    SharedTranslationsModule
  ],
  declarations: [TabsPage]
})
export class TabsPageModule {}
