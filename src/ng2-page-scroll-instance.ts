/**
 * Created by sebastianfuss on 29.08.16.
 */

import {EventEmitter} from '@angular/core';

import {EasingLogic, PageScrollConfig, PageScrollTarget, PageScrollingViews} from './ng2-page-scroll-config';
import {PageScrollUtilService} from './ng2-page-scroll-util.service';

/**
 * Represents a scrolling action
 */
export class PageScrollInstance {

    /**
     * These properties will be set during instance construction
     */

    /* A namespace to "group" scroll animations together and stopping some does not stop others */
    private _namespace: string = PageScrollConfig._defaultNamespace;
    /* The document all the scrolling takes place and scroll targets are located in */
    private document: Document;
    /* The DOM elements or similar nodes whose scrollTop/scrollLeft property will be manipulated during scrolling */
    private _scrollingViews: PageScrollingViews[];
    private _isInlineScrolling: boolean;
    /* The target element that should be scrolled into the viewport */
    private _scrollTarget: PageScrollTarget;

    /* Whether we scroll vertically (true) or horizontally (false) */
    private _verticalScrolling = PageScrollConfig.defaultIsVerticalScrolling;
    /* Offset in px that the animation should stop above that target element */
    private _offset: number = PageScrollConfig.defaultScrollOffset;
    /* Duration in milliseconds the scroll animation should last */
    private _duration: number = PageScrollConfig.defaultDuration;
    /* Easing function to manipulate the scrollTop/scrollLeft value over time */
    private _easingLogic: EasingLogic = PageScrollConfig.defaultEasingLogic;
    /* Boolean whether the scroll animation should stop on user interruption or not */
    private _interruptible: boolean = PageScrollConfig.defaultInterruptible;
    /* The listener that this scroll instance attaches to the body to listen for interrupt events
     We're keeping a reference to it so we can properly remove it when the animation finishes */
    private _interruptListener: EventListenerOrEventListenerObject;
    /* Event emitter to notify the world about the scrolling */
    private _pageScrollFinish: EventEmitter<boolean> = new EventEmitter<boolean>();

    /**
     * These properties will be set/manipulated if the scroll animation starts
     */
    /* The initial value of the scrollTop or scrollLeft position when the animation starts */
    private _startScrollPosition = 0;
    /* The target value of the scrollTop or scrollLeft position for the animation (aka "the final destination") */
    private _targetScrollPosition: number;
    /* Difference between startScrollPosition and targetScrollPosition. Pre-calculated to minimize computations during animation */
    private _distanceToScroll: number;
    /* The timestamp when the animation starts/got started */
    private _startTime: number;
    /* The estimate end time of the animation, calculated by startTime + duration */
    private _endTime: number;
    /* Whether an interrupt listener is attached to the body or not */
    private _interruptListenersAttached = false;

    /* References to the timer instance that is used to perform the scroll animation to be
     able to clear it on animation end*/
    private _timer: any = null;

    /*
     * Factory methods for instance creation
     */
    public static simpleInstance(document: Document,
                                 scrollTarget: PageScrollTarget,
                                 namespace?: string): PageScrollInstance {
        return PageScrollInstance.simpleDirectionInstance(
            document,
            scrollTarget,
            true,
            namespace
        );
    }

    /**
     * Create a PageScrollInstance representing a scroll animation on the documents body.
     *
     * @param document The document that contains the body to be scrolled and the scrollTarget elements
     * @param scrollTarget Where to scroll to. Can be a HTMLElement reference or a string like '#elementId'
     * @param isVerticalScrolling
     * @param namespace Optional namespace to group scroll animations logically
     *
     * @returns {PageScrollInstance}
     */
    public static simpleDirectionInstance(document: Document,
                                          scrollTarget: PageScrollTarget,
                                          isVerticalScrolling: boolean,
                                          namespace?: string): PageScrollInstance {
        return PageScrollInstance.advancedInstance(
            document,
            scrollTarget,
            null,
            namespace,
            isVerticalScrolling,
            null,
            null,
            null,
            null,
            null
        );
    }

    /**
     * Create a PageScrollInstance representing a scroll animation to the target element where the scrollingView
     * elements get scrolled (like a div container with fixed height, resulting in scrollbars in it).
     *
     * Make sure that the scrollTarget is located inside the scrollingView in the DOM hierarchy, otherwise the
     * scrollingView will be scrolled to an apparently arbitrary position.
     *
     * @param document The document that contains the body to be scrolled and the scrollTarget elements
     * @param scrollTarget Where to scroll to. Can be a HTMLElement reference or a string like '#elementId'
     * @param scrollingView The element that should be scrolled
     * @param namespace Optional namespace to group scroll animations logically
     *
     * @returns {PageScrollInstance}
     */
    public static simpleInlineInstance(document: Document,
                                       scrollTarget: PageScrollTarget,
                                       scrollingView: PageScrollingViews,
                                       namespace?: string): PageScrollInstance {
        return PageScrollInstance.simpleInlineDirectionInstance(
            document,
            scrollTarget,
            scrollingView,
            true,
            namespace
        );
    }

    public static simpleInlineDirectionInstance(document: Document,
                                                scrollTarget: PageScrollTarget,
                                                scrollingView: PageScrollingViews,
                                                isVerticalScrolling: boolean,
                                                namespace?: string): PageScrollInstance {
        return PageScrollInstance.advancedInstance(
            document,
            scrollTarget,
            [scrollingView],
            namespace,
            isVerticalScrolling,
            null,
            null,
            null,
            null,
            null
        );
    }

    /**
     *
     * @param document The document that contains the body to be scrolled and the scrollTarget elements
     * @param scrollTarget Where to scroll to. Can be a HTMLElement reference or a string like '#elementId'
     * @param scrollingViews The elements that should be scrolled. Null to use the default elements of document and body.
     * @param namespace Optional namespace to group scroll animations logically
     * @param isVerticalScrolling whether the scrolling should be performed in vertical direction (true, default) or horizontal (false)
     * @param pageScrollOffset The offset to be attached to the top of the target element or
     *                          null/undefined to use application default
     * @param pageScrollInterruptible Whether this scroll animation should be interruptible.
     *                                 Null/undefined for application default
     * @param pageScrollEasingLogic Easing function to be used for manipulating the scroll position
     *                          over time. Null/undefined for application default
     * @param pageScrollDuration The duration in milliseconds the animation should last.
     *                            Null/undefined for application default
     * @param pageScrollFinishListener Listener to be called to notify other parts of the application
     *                                  that the scroll animation has finished
     *
     * @returns {PageScrollInstance}
     */
    public static advancedInstance(document: Document,
                                   scrollTarget: PageScrollTarget,
                                   scrollingViews: PageScrollingViews[] = null,
                                   namespace: string,
                                   isVerticalScrolling: boolean,
                                   pageScrollOffset: number = null,
                                   pageScrollInterruptible: boolean = null,
                                   pageScrollEasingLogic: EasingLogic = null,
                                   pageScrollDuration: number = null,
                                   pageScrollFinishListener: EventEmitter<boolean> = null): PageScrollInstance {

        if (PageScrollUtilService.isUndefinedOrNull(namespace) || namespace.length <= 0) {
            namespace = PageScrollConfig._defaultNamespace;
        }
        let pageScrollInstance: PageScrollInstance = new PageScrollInstance(namespace, document);

        if (PageScrollUtilService.isUndefinedOrNull(scrollingViews) || scrollingViews.length === 0) {
            pageScrollInstance._isInlineScrolling = false;
            pageScrollInstance._scrollingViews = [document.documentElement, document.body, document.body.parentNode];
        } else {
            pageScrollInstance._isInlineScrolling = true;
            pageScrollInstance._scrollingViews = scrollingViews;
        }

        pageScrollInstance._scrollTarget = scrollTarget;

        if (!PageScrollUtilService.isUndefinedOrNull(isVerticalScrolling)) {
            pageScrollInstance._verticalScrolling = isVerticalScrolling;
        }

        if (!PageScrollUtilService.isUndefinedOrNull(pageScrollOffset)) {
            pageScrollInstance._offset = pageScrollOffset;
        }

        if (!PageScrollUtilService.isUndefinedOrNull(pageScrollEasingLogic)) {
            pageScrollInstance._easingLogic = pageScrollEasingLogic;
        }

        if (!PageScrollUtilService.isUndefinedOrNull(pageScrollDuration)) {
            pageScrollInstance._duration = pageScrollDuration;
        }

        if (!PageScrollUtilService.isUndefinedOrNull(pageScrollFinishListener)) {
            pageScrollInstance._pageScrollFinish = pageScrollFinishListener;
        }

        pageScrollInstance._interruptible = pageScrollInterruptible ||
            (PageScrollUtilService.isUndefinedOrNull(pageScrollInterruptible) && PageScrollConfig.defaultInterruptible);

        return pageScrollInstance;
    }

    /**
     * Private constructor, requires the properties assumed to be the bare minimum.
     * Use the factory methods to create instances: {@link PageScrollInstance#simpleInstance}
     * @param namespace
     * @param document
     */
    constructor(namespace: string, document: Document) {
        this._namespace = namespace;
        this.document = document;
    }

    public getScrollPropertyValue(scrollingView: any): number {
        if (!this.verticalScrolling) {
            return scrollingView.scrollLeft;
        }
        return scrollingView.scrollTop;
    }

    /**
     * Extract the exact location of the scrollTarget element.
     *
     * Extract the scrollTarget HTMLElement from the given PageScrollTarget object. The latter one may be
     * a string like "#heading2", then this method returns the corresponding DOM element for that id.
     *
     * @returns {HTMLElement}
     */
    public extractScrollTargetPosition(): {top: number, left: number} {
        let scrollTargetElement: HTMLElement;
        if (typeof this._scrollTarget === 'string') {
            scrollTargetElement = this.document.getElementById((<string>this._scrollTarget).substr(1));
        } else {
            scrollTargetElement = <HTMLElement>this._scrollTarget;
        }

        if (scrollTargetElement === null || scrollTargetElement === undefined) {
            // Scroll target not found
            return {top: NaN, left: NaN};
        }

        if (this._isInlineScrolling) {
            return {top: scrollTargetElement.offsetTop, left: scrollTargetElement.offsetLeft};
        }

        return PageScrollUtilService.extractElementPosition(this.document, scrollTargetElement);
    }

    /**
     * Get the top offset of the scroll animation.
     * This automatically takes the offset location of the scrolling container/scrolling view
     * into account (for nested/inline scrolling).
     *
     * @returns {number}
     */
    public getCurrentOffset(): number {
        return this._offset;
    }

    /**
     * Sets the "scrollTop" or "scrollLeft" property for all scrollingViews to the provided value
     * @param position
     * @return true if at least for one ScrollTopSource the scrollTop/scrollLeft value could be set and it kept the new value.
     *          false if it failed for all ScrollingViews, meaning that we should stop the animation
     *          (probably because we're at the end of the scrolling region)
     */
    public setScrollPosition(position: number): boolean {
        if (PageScrollConfig._logLevel >= 5) {
            console.warn('Scroll Position: ' + position);
        }
        // Set the new scrollTop/scrollLeft to all scrollingViews elements
        return this.scrollingViews.reduce((oneAlreadyWorked: any, scrollingView: any) => {
            let startScrollPropertyValue = this.getScrollPropertyValue(scrollingView);
            if (scrollingView && !PageScrollUtilService.isUndefinedOrNull(startScrollPropertyValue)) {
                let scrollDistance = Math.abs(startScrollPropertyValue - position);

                // The movement we need to perform is less than 2px
                // This we consider a small movement which some browser may not perform when
                // changing the scrollTop/scrollLeft property
                // Thus in this cases we do not stop the scroll animation, although setting the
                // scrollTop/scrollLeft value "fails"
                let isSmallMovement = scrollDistance < PageScrollConfig._minScrollDistance;

                if (!this.verticalScrolling) {
                    scrollingView.scrollLeft = position;
                } else {
                    scrollingView.scrollTop = position;
                }

                // Return true of setting the new scrollTop/scrollLeft value worked
                // We consider that it worked if the new scrollTop/scrollLeft value is closer to the
                // desired scrollTop/scrollLeft than before (it might not be exactly the value we
                // set due to dpi or rounding irregularities)
                if (isSmallMovement || scrollDistance > Math.abs(this.getScrollPropertyValue(scrollingView) - position)) {
                    return true;
                }
            }
            return oneAlreadyWorked;
        }, false);
    }

    /**
     * Trigger firing a animation finish event
     * @param value Whether the animation finished at the target (true) or got interrupted (false)
     */
    public fireEvent(value: boolean): void {
        if (this._pageScrollFinish) {
            this._pageScrollFinish.emit(value);
        }
    }

    /**
     * Attach the interrupt listeners to the PageScrollInstance body. The given interruptReporter
     * will be called if any of the attached events is fired.
     *
     * Possibly attached interruptListeners are automatically removed from the body before the new one will be attached.
     *
     * @param interruptReporter
     */
    public attachInterruptListeners(interruptReporter: InterruptReporter): void {
        if (this._interruptListenersAttached) {
            // Detach possibly existing listeners first
            this.detachInterruptListeners();
        }
        this._interruptListener = (event: Event): void => {
            interruptReporter.report(event, this);
        };
        PageScrollConfig._interruptEvents.forEach(
            (event: string) => this.document.body.addEventListener(event, this._interruptListener)
        );
        this._interruptListenersAttached = true;
    }

    /**
     * Remove event listeners from the body and stop listening for events that might be treated as "animation
     * interrupt" events.
     */
    public detachInterruptListeners(): void {
        PageScrollConfig._interruptEvents.forEach(
            (event: string) => this.document.body.removeEventListener(event, this._interruptListener)
        );
        this._interruptListenersAttached = false;
    }

    public get namespace(): string {
        return this._namespace;
    }

    get verticalScrolling(): boolean {
        return this._verticalScrolling;
    }

    public get scrollingViews(): any[] {
        return this._scrollingViews;
    }

    public set startScrollPosition(value: number) {
        this._startScrollPosition = value;
    }

    public get startScrollPosition(): number {
        return this._startScrollPosition;
    }

    public set targetScrollPosition(value: number) {
        this._targetScrollPosition = value;
    }

    public get targetScrollPosition(): number {
        return this._targetScrollPosition;
    }

    public set distanceToScroll(value: number) {
        this._distanceToScroll = value;
    }

    public get distanceToScroll(): number {
        return this._distanceToScroll;
    }

    public get duration(): number {
        return this._duration;
    }

    public get easingLogic(): EasingLogic {
        return this._easingLogic;
    }

    public get interruptible(): boolean {
        return this._interruptible;
    }

    public set startTime(value: number) {
        this._startTime = value;
    }

    public get startTime(): number {
        return this._startTime;
    }

    public set endTime(value: number) {
        this._endTime = value;
    }

    public get endTime(): number {
        return this._endTime;
    }

    public set timer(value: any) {
        this._timer = value;
    }

    public get timer(): any {
        return this._timer;
    }

    public get interruptListenersAttached(): boolean {
        return this._interruptListenersAttached;
    }
}

/**
 * An Interface a listener should implement to be notified about possible interrupt events
 * that happend due to user interaction while a scroll animation takes place.
 *
 * The PageScrollService provides an implementation to a PageScrollInstance to be notified
 * about scroll animation interrupts and stop related animations.
 */
export interface InterruptReporter {
    report: {
        (event: Event, pageScrollInstance: PageScrollInstance): void;
    };
}
