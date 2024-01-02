import { APP_BASE_HREF } from "@angular/common";
import { Inject, Injectable, OnDestroy } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { NavigationBehaviorOptions, NavigationStart, Router } from "@angular/router";
import { Subscription, from, of } from "rxjs";
import { filter, map, switchMap, tap } from "rxjs/operators";

class HistoryEntry {
  constructor(
    public id: number,
    public state: any,
    public title: string,
    public url: string
  ) {}
}

@Injectable({
  providedIn: 'root'
})
export class CustomRouter extends Router implements OnDestroy {
  private history: HistoryEntry[] = [];
  private navigateByUrlActive = false;
  private currentIndex: number = 0;
  private subscription: Subscription;

  constructor(@Inject(APP_BASE_HREF) private baseHref: string, title: Title) {
    super();
    this.subscription = this.events.pipe(
      filter(event => event instanceof NavigationStart),
      switchMap(event => {
        const currentNavigation = this.getCurrentNavigation();
        const state = currentNavigation?.extras.state;
        return from(this.handleEvent(event as any, { state })).pipe(
          map(() => currentNavigation)
        );
      })
    ).subscribe(currentNavigation => {
      if (!this.navigateByUrlActive) {
        this.history.push(new HistoryEntry(this.createNavigationId(), currentNavigation?.extras.state, title.getTitle(), this.url));
        this.currentIndex = this.history.length - 1;
      }
    });
  }

  override ngOnDestroy() {
    this.subscription.unsubscribe();
    super.ngOnDestroy();
  }

  private handleEvent(event: NavigationStart, options: NavigationBehaviorOptions = {}) {
    const item = this.history.find((item, index) => {
      if (event.restoredState?.navigationId === item.id) {
        this.currentIndex = index;
        return true;
      }
      return false;
    });
    if(item) {
      this.navigateByUrlActive = true;
      return from(this.navigateByUrl(item.url, options)).pipe(
        tap(() => this.navigateByUrlActive = false)
      );
    }
    return of(event);
  }

  public getHistory(): string[] {
    return this.history.map(entry => entry.url);
  }

  public getPreviousUrl(): string {
    return this.history[this.currentIndex - 1]?.url || this.baseHref;
  }

  public getNextUrl(): string {
    return this.history[this.currentIndex + 1]?.url || this.baseHref;
  }

  public back(): void {
    if (this.currentIndex > 0) {
      const prevUrl = this.getPreviousUrl();
      this.navigateByUrl(prevUrl);
      this.currentIndex--;
    }
  }

  public forward(): void {
    if (this.currentIndex < this.history.length - 1) {
      const nextUrl = this.getNextUrl();
      this.navigateByUrl(nextUrl);
      this.currentIndex++;
    }
  }

  public go(delta: number): void {
    const targetIndex = this.currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < this.history.length) {
      const targetUrl = this.history[targetIndex].url;
      this.navigateByUrl(targetUrl);
      this.currentIndex = targetIndex;
    }
  }

  public pushState(state: any, title: string, url: string): void {
    this.navigateByUrlActive = true;
    this.navigateByUrl(url).then(() => {
      this.history.push(new HistoryEntry(this.createNavigationId(), state, title, url));
      this.currentIndex = this.history.length - 1;
      this.navigateByUrlActive = false;
    });
  }

  public replaceState(state: any, title: string, url: string): void {
    this.navigateByUrlActive = true;
    this.navigateByUrl(url).then(() => {
      this.history[this.currentIndex] = new HistoryEntry(this.createNavigationId(), state, title, url);
      this.navigateByUrlActive = false;
    });
  }

  private createNavigationId(): number {
    return this.history.length > 0 ? Math.max(...this.history.map(item => item.id)) + 1 : 1;
  }
}
