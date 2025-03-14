import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { from, Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { AvatarService } from '../services/avatar.service';

@Injectable({
  providedIn: 'root',
})
export class DriverProfileGuard implements CanActivate {
  constructor(
    private auth: Auth,
    private router: Router,
    private avatar: AvatarService
  ) {}

  canActivate(): Observable<boolean> {
    return from(new Promise<User | null>((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        console.log('Auth state changed, user:', user);
        resolve(user);
      });
    })).pipe(
      switchMap((user) => {
        if (!user) {
          console.log('User not authenticated, redirecting to login.');
          this.router.navigate(['login']);
          return of(false);
        }
        console.log('Authenticated user found:', user);
        return from(this.avatar.getUserType(user.uid)).pipe(
          map((userType) => {
            if (userType === 'rider') {
              console.log('User is a rider, redirecting to login.');
              this.signOutAndRedirect();
              return false;
            } else if (!user.displayName || !user.email || !user.photoURL) {
              console.log('User profile incomplete, redirecting to details.');
              this.router.navigate(['details']);
              return false;
            }
            console.log('User authenticated and profile complete, allowing access.');
            return true;
          }),
          catchError((error) => {
            console.error('Error fetching user type:', error);
            this.router.navigate(['network']);
            return of(false);
          })
        );
      })
    );
  }

  private signOutAndRedirect(): void {
    this.auth.signOut().then(() => {
      this.router.navigate(['login']);
    }).catch((error) => {
      console.error('Error signing out:', error);
      this.router.navigate(['login']);
    });
  }
}
