import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';

import { User, UserRole } from '../../models/user.model';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatToolbarModule,
    MatIconModule
  ],
  templateUrl: './user-login.component.html',
  styleUrl: './user-login.component.scss'
})
export class UserLoginComponent implements OnInit {
  users: User[] = [];
  selectedUserId: string = '';

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.users = this.userService.getAllUsers();
    
    // Check if user is already logged in
    const currentUser = this.userService.getCurrentUser();
    if (currentUser) {
      this.navigateBasedOnRole(currentUser);
    }
  }

  onLogin(): void {
    if (!this.selectedUserId) {
      return;
    }

    const selectedUser = this.userService.getUserById(this.selectedUserId);
    if (selectedUser) {
      this.userService.setCurrentUser(selectedUser);
      this.navigateBasedOnRole(selectedUser);
    }
  }

  private navigateBasedOnRole(user: User): void {
    if (user.role === UserRole.ISSUER) {
      this.router.navigate(['/issuer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  getUserRoleDisplay(role: UserRole): string {
    switch (role) {
      case UserRole.ISSUER:
        return 'Cash Issuer';
      case UserRole.REQUESTER:
        return 'Cash Requester';
      case UserRole.ADMIN:
        return 'Administrator';
      default:
        return role;
    }
  }
}
