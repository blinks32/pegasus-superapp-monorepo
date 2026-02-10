import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./login/login.module').then((m) => m.LoginPageModule)
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomePageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'details',
    loadChildren: () =>
      import('./pages/details/details.module').then((m) => m.DetailsPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'history',
    loadChildren: () =>
      import('./pages/history/history.module').then((m) => m.HistoryPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'drivers',
    loadChildren: () =>
      import('./pages/drivers/drivers.module').then((m) => m.DriversPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'customers',
    loadChildren: () =>
      import('./pages/customers/customers.module').then((m) => m.CustomersPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'cartypes',
    loadChildren: () =>
      import('./pages/cartypes/cartypes.module').then((m) => m.CartypesPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'prices',
    loadChildren: () =>
      import('./pages/prices/prices.module').then((m) => m.PricesPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'documents',
    loadChildren: () =>
      import('./pages/documents/documents.module').then((m) => m.DocumentsPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'support',
    loadChildren: () =>
      import('./pages/support/support.module').then((m) => m.SupportPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'payout',
    loadChildren: () =>
      import('./pages/payout/payout.module').then((m) => m.PayoutPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'rider-app',
    loadChildren: () =>
      import('./pages/rider-app/rider-app.module').then((m) => m.RiderAppPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'driver-app',
    loadChildren: () =>
      import('./pages/driver-app/driver-app.module').then((m) => m.DriverAppPageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./pages/profile/profile.module').then((m) => m.ProfilePageModule),
    data: { menuEnabled: true }
  },
  {
    path: 'general-settings',
    loadChildren: () =>
      import('./pages/general-settings/general-settings.module').then((m) => m.GeneralSettingsPageModule),
    data: { menuEnabled: true }
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { 
      preloadingStrategy: PreloadAllModules,
      useHash: true, // Use hash navigation for more compatibility
      enableTracing: true // Enable debug tracing for router
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
