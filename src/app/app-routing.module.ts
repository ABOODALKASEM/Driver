import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { canActivate, redirectLoggedInTo, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { DriverProfileGuard } from './guards/driver-profile.guard';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['login']);
const redirectLoggedInToHome = () => redirectLoggedInTo(['tabs']);

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./login/login.module').then((m) => m.LoginPageModule),
    ...canActivate(redirectLoggedInToHome),
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [DriverProfileGuard],  // Protect the tabs route with the new guard
  },
  {
    path: 'details',
    loadChildren: () => import('./pages/details/details.module').then(m => m.DetailsPageModule),
    ...canActivate(redirectUnauthorizedToLogin),
  },
  {
    path: 'payment',
    loadChildren: () => import('./pages/payment/payment.module').then(m => m.PaymentPageModule),
    canActivate: [DriverProfileGuard],  // Ensure protected route
  },
  {
    path: 'support',
    loadChildren: () => import('./pages/support/support.module').then(m => m.SupportPageModule),
    canActivate: [DriverProfileGuard],  // Ensure protected route
  },
  {
    path: 'about',
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule),
    canActivate: [DriverProfileGuard],  // Ensure protected route
  },
  {
    path: 'rating',
    loadChildren: () => import('./pages/rating/rating.module').then(m => m.RatingPageModule),
    canActivate: [DriverProfileGuard],  // Ensure protected route
  },
  {
    path: 'network',
    loadChildren: () => import('./pages/network/network.module').then(m => m.NetworkPageModule),
    canActivate: [DriverProfileGuard],  // Ensure protected route
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
