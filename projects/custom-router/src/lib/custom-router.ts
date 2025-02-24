import { APP_BASE_HREF } from "@angular/common";
import { Inject, Injectable, OnDestroy } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { NavigationBehaviorOptions, NavigationStart, Router } from "@angular/router";
import { Subscription, from, of } from "rxjs";
import { filter, switchMap, tap } from "rxjs/operators";

class HistoryEntry {
  constructor(
    public id: number,
    public state: any,
    public title: string,
    public url: string,
    public scrollPosition: { x: number, y: number }
  ) {}
}

@Injectable({
  providedIn: 'root'
})
export class CustomRouter extends Router implements OnDestroy {
  private history: HistoryEntry[] = [];
  private navigateByUrlActive = false;
  private currentIndex = 0;
  private subscription: Subscription;

  constructor(@Inject(APP_BASE_HREF) private baseHref: string, private title: Title) {
    super();
    this.subscription = this.events.pipe(
      filter(event => event instanceof NavigationStart),
      tap(() => this.saveScrollPosition()),
      switchMap(event => this.handleNavigation(event as NavigationStart))
    ).subscribe();
  }

  override ngOnDestroy(): void {
    this.subscription.unsubscribe();
    super.ngOnDestroy();
  }

  private handleNavigation(event: NavigationStart) {
    const currentNavigation = this.getCurrentNavigation();
    const state = currentNavigation?.extras.state;

    if (event.restoredState) {
      return this.handleRestoredState(event.restoredState.navigationId, state);
    } else {
      return this.addHistoryEntry(currentNavigation, state);
    }
  }

  private handleRestoredState(navigationId: number, state: any) {
    const historyItem = this.history.find(item => item.id === navigationId);
    if (historyItem) {
      this.navigateByUrlActive = true;
      return from(this.navigateByUrl(historyItem.url)).pipe(
        tap(() => this.restoreScrollPosition(historyItem.scrollPosition))
      );
    }
    return of(null);
  }

  private addHistoryEntry(currentNavigation: any, state: any) {
    if (!this.navigateByUrlActive) {
      const scrollPosition = { x: window.scrollX, y: window.scrollY };
      this.history.push(new HistoryEntry(this.createNavigationId(), state, this.title.getTitle(), this.url, scrollPosition));
      this.currentIndex = this.history.length - 1;
    }
    return of(currentNavigation);
  }

  private restoreScrollPosition(position: { x: number, y: number }) {
    window.scrollTo(position.x, position.y);
    this.navigateByUrlActive = false;
  }

  private saveScrollPosition() {
    // We don't need to update the scroll position on every navigation, just when needed.
    this.history[this.currentIndex].scrollPosition = { x: window.scrollX, y: window.scrollY };
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
      this.navigateToHistoryEntry(this.currentIndex - 1);
    }
  }

  public forward(): void {
    if (this.currentIndex < this.history.length - 1) {
      this.navigateToHistoryEntry(this.currentIndex + 1);
    }
  }

  public go(delta: number): void {
    const targetIndex = this.currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < this.history.length) {
      this.navigateToHistoryEntry(targetIndex);
    }
  }

  private navigateToHistoryEntry(index: number): void {
    const targetEntry = this.history[index];
    this.navigateByUrl(targetEntry.url);
    this.currentIndex = index;
  }

  public pushState(state: any, title: string, url: string): void {
    this.addStateToHistory(state, title, url);
  }

  public replaceState(state: any, title: string, url: string): void {
    this.replaceStateInHistory(state, title, url);
  }

  private addStateToHistory(state: any, title: string, url: string): void {
    this.navigateByUrlActive = true;
    this.navigateByUrl(url).then(() => {
      const scrollPosition = { x: window.scrollX, y: window.scrollY };
      this.history.push(new HistoryEntry(this.createNavigationId(), state, title, url, scrollPosition));
      this.currentIndex = this.history.length - 1;
      this.navigateByUrlActive = false;
    });
  }

  private replaceStateInHistory(state: any, title: string, url: string): void {
    this.navigateByUrlActive = true;
    this.navigateByUrl(url).then(() => {
      this.history[this.currentIndex] = new HistoryEntry(this.createNavigationId(), state, title, url, { x: window.scrollX, y: window.scrollY });
      this.navigateByUrlActive = false;
    });
  }

  private createNavigationId(): number {
    return this.history.length > 0 ? Math.max(...this.history.map(item => item.id)) + 1 : 1;
  }
}
