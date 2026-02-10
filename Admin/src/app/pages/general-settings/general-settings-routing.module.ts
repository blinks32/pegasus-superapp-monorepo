import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GeneralSettingsPage } from './general-settings.page';

const routes: Routes = [
  {
    path: '',
    component: GeneralSettingsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GeneralSettingsPageRoutingModule {}
