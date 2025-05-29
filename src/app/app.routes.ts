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
    path: 'manager-dashboard',
    loadComponent: () => import('./components/manager-dashboard/manager-dashboard.component').then(m => m.ManagerDashboardComponent)
  },
  {
    path: 'request-details/:id',
    loadComponent: () => import('./components/request-details/request-details.component').then(m => m.RequestDetailsComponent)
  },
  {
    path: 'inventory-management',
    loadComponent: () => import('./components/inventory-management/inventory-management.component').then(m => m.InventoryManagementComponent)
  },
  {
    path: 'alerts-overview',
    loadComponent: () => import('./components/alerts-overview/alerts-overview.component').then(m => m.AlertsOverviewComponent)
  },
  { path: '**', redirectTo: '/login' }
];
