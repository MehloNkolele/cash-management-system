import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/user-login/user-login.component').then(m => m.UserLoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'request-form',
    loadComponent: () => import('./components/cash-request-form/cash-request-form.component').then(m => m.CashRequestFormComponent)
  },
  {
    path: 'issuer-dashboard',
    loadComponent: () => import('./components/issuer-dashboard/issuer-dashboard.component').then(m => m.IssuerDashboardComponent)
  },
  {
    path: 'request-details/:id',
    loadComponent: () => import('./components/request-details/request-details.component').then(m => m.RequestDetailsComponent)
  },
  { path: '**', redirectTo: '/login' }
];
