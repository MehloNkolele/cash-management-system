import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserRole, Department } from '../models/user.model';
import { LocalStorageService } from './local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly USERS_KEY = 'cash_mgmt_users';
  private readonly CURRENT_USER_KEY = 'cash_mgmt_current_user';
  private readonly DEPARTMENTS_KEY = 'cash_mgmt_departments';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private localStorageService: LocalStorageService) {
    this.initializeData();
    this.loadCurrentUser();
  }

  private initializeData(): void {
    // Initialize with sample data if not exists
    if (!this.localStorageService.getItem(this.USERS_KEY)) {
      this.createSampleUsers();
    }

    if (!this.localStorageService.getItem(this.DEPARTMENTS_KEY)) {
      this.createSampleDepartments();
    }
  }

  private createSampleUsers(): void {
    const sampleUsers: User[] = [
      {
        id: '1',
        ab: 'AB001',
        fullName: 'Thando',
        email: 'thando@company.com',
        contactNumber: '+27 11 123 4567',
        role: UserRole.ISSUER,
        department: 'Alternative Channels'
      },
      {
        id: '2',
        ab: 'AB002',
        fullName: 'Tiisetso',
        email: 'tiisetso@company.com',
        contactNumber: '+27 11 123 4568',
        role: UserRole.ISSUER,
        department: 'Alternative Channels'
      },
      {
        id: '3',
        ab: 'AB003',
        fullName: 'Bennet',
        email: 'bennet@company.com',
        contactNumber: '+27 11 123 4569',
        role: UserRole.REQUESTER,
        department: 'QA Testing'
      },
      {
        id: '4',
        ab: 'AB004',
        fullName: 'Judas',
        email: 'judas@company.com',
        contactNumber: '+27 11 123 4570',
        role: UserRole.REQUESTER,
        department: 'QA Testing'
      }
    ];

    this.localStorageService.setItem(this.USERS_KEY, sampleUsers);
  }

  private createSampleDepartments(): void {
    const departments: Department[] = [
      { id: '1', name: 'Alternative Channels' },
      { id: '2', name: 'QA Testing' },
      { id: '3', name: 'Digital Banking' },
      { id: '4', name: 'Mobile Banking' },
      { id: '5', name: 'Self Service' }
    ];

    this.localStorageService.setItem(this.DEPARTMENTS_KEY, departments);
  }

  private loadCurrentUser(): void {
    const currentUser = this.localStorageService.getItem<User>(this.CURRENT_USER_KEY);
    this.currentUserSubject.next(currentUser);
  }

  getAllUsers(): User[] {
    return this.localStorageService.getItem<User[]>(this.USERS_KEY) || [];
  }

  getUserById(id: string): User | null {
    const users = this.getAllUsers();
    return users.find(user => user.id === id) || null;
  }

  getIssuers(): User[] {
    return this.getAllUsers().filter(user => user.role === UserRole.ISSUER);
  }

  getDepartments(): Department[] {
    return this.localStorageService.getItem<Department[]>(this.DEPARTMENTS_KEY) || [];
  }

  setCurrentUser(user: User): void {
    this.localStorageService.setItem(this.CURRENT_USER_KEY, user);
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  logout(): void {
    this.localStorageService.removeItem(this.CURRENT_USER_KEY);
    this.currentUserSubject.next(null);
  }

  isIssuer(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser?.role === UserRole.ISSUER;
  }

  isRequester(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser?.role === UserRole.REQUESTER;
  }
}
