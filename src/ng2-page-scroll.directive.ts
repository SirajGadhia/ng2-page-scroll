import {Directive, Input, Output, EventEmitter, OnDestroy, Inject, Optional} from '@angular/core';
import {Router, NavigationEnd, NavigationError, NavigationCancel, UrlTree} from '@angular/router';
import {DOCUMENT} from '@angular/platform-browser';

import {Subscription} from 'rxjs/Subscription';

import {PageScrollService} from './ng2-page-scroll.service';
import {PageScrollInstance} from './ng2-page-scroll-instance';
import {PageScrollUtilService} from './ng2-page-scroll-util.service';
import {EasingLogic} from './ng2-page-scroll-config';

@Directive({
    selector: '[pageScroll]',
    host: { // tslint:disable-line:use-host-property-decorator
        '(click)': 'handleClick($event)',
    }
})
export class PageScroll implements OnDestroy {

    @Input()
    public routerLink: any;

    @Input()
    public href: string;

    @Input()
    public pageScrollHorizontal: boolean = null;

    @Input()
    public pageScrollOffset: number = null;

    @Input()
    public pageScrollDuration: number = null;

    @Input()
    public pageScrollEasing: EasingLogic = null;

    @Input()
    public pageScrollInterruptible: boolean;

    @Input()
    public pageScroll: string = null;

    @Output()
    pageScrollFinish: EventEmitter<boolean> = new EventEmitter<boolean>();

    private pageScrollInstance: PageScrollInstance;
    private document: Document;

    constructor(private pageScrollService: PageScrollService, @Optional() private router: Router, @Inject(DOCUMENT) document: any) {
        this.document = <Document> document;
    }

    ngOnDestroy(): any {
        if (this.pageScrollInstance) {
            this.pageScrollService.stop(this.pageScrollInstance);
        }
        return undefined;
    }

    private generatePageScrollInstance(): PageScrollInstance {
        if (PageScrollUtilService.isUndefinedOrNull(this.pageScrollInstance)) {
            this.pageScrollInstance = PageScrollInstance.advancedInstance(
                this.document,
                this.href,
                null,
                this.pageScroll,
                !this.pageScrollHorizontal,
                this.pageScrollOffset,
                this.pageScrollInterruptible,
                this.pageScrollEasing,
                this.pageScrollDuration,
                this.pageScrollFinish
            );
        }
        return this.pageScrollInstance;
    }

    public handleClick(clickEvent: Event): boolean { // tslint:disable-line:no-unused-variable

        if (this.routerLink && this.router !== null && this.router !== undefined) {
            let urlTree: UrlTree;
            if (typeof this.routerLink === 'string') {
                urlTree = this.router.parseUrl(this.routerLink);
            } else {
                urlTree = this.router.createUrlTree(this.routerLink);
            }
            if (!this.router.isActive(urlTree, true)) {
                // We need to navigate their first.
                // Navigation is handled by the routerLink directive
                // so we only need to listen for route change
                let subscription: Subscription = <Subscription>this.router.events.subscribe((routerEvent) => {
                    if (routerEvent instanceof NavigationEnd) {
                        subscription.unsubscribe();
                        this.pageScrollService.start(this.generatePageScrollInstance());
                    } else if (routerEvent instanceof NavigationError || routerEvent instanceof NavigationCancel) {
                        subscription.unsubscribe();
                    }
                });
                return false; // to preventDefault()
            }
        }
        this.pageScrollService.start(this.generatePageScrollInstance());
        return false; // to preventDefault()
    }

}
