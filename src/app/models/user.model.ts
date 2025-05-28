export interface User {
  id: string;
  ab: string; // Employee identifier
  fullName: string;
  email: string;
  contactNumber: string;
  role: UserRole;
  department: string;
}

export enum UserRole {
  REQUESTER = 'requester',
  ISSUER = 'issuer',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

export interface Department {
  id: string;
  name: string;
}
