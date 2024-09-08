import { Application } from '@nativescript/core';
import { CLog, CLogTypes, headersProperty, VideoCommon, videoSourceProperty } from './videoplayer-common';
export class Video extends VideoCommon {
    constructor() {
        super();
        this._src = '';
        this._videoFinished = false;
        this.videoLoaded = false;
        this._playerController = AVPlayerViewController.new();
        CLog(CLogTypes.info, 'this._playerController', this._playerController);
        this.player = AVPlayer.new();
        CLog(CLogTypes.info, 'this.player', this.player);
        this._playerController.player = this.player;
        this._playerController.showsPlaybackControls = false;
        this.nativeView = this._playerController.view;
        this._observer = PlayerObserverClass.alloc().init();
        CLog(CLogTypes.info, 'this._observer', this._observer);
        this._observer['_owner'] = this;
        this._observer.owner = this;
    }
    [headersProperty.setNative](value) {
        this._setHeader(value ? value : null);
    }
    [videoSourceProperty.setNative](value) {
        this._setNativeVideo(value ? value.ios : null);
    }
    _setHeader(headers) {
        CLog(CLogTypes.info, 'Video._setHeader ---', `headers: ${headers}`);
        if (headers && headers.size > 0) {
            this._headers = new NSMutableDictionary();
            CLog(CLogTypes.info, `Video._setHeader ---`, `this._headers: ${this._headers}`);
            headers.forEach((value, key) => {
                this._headers.setValueForKey(value, key);
            });
        }
        if (this._src) {
            CLog(CLogTypes.info, 'Video._setHeader ---', `this._src: ${this._src}`);
            this._setNativePlayerSource(this._src);
        }
    }
    _setNativeVideo(nativeVideoPlayer) {
        CLog(CLogTypes.info, 'Video._setNativeVideo ---', `nativeVideoPlayer: ${nativeVideoPlayer}`);
        if (this._url && this._headers && this._headers.count > 0) {
            CLog(CLogTypes.warning, 'Need to add headers!');
            const url = NSURL.URLWithString(this._url);
            CLog(CLogTypes.info, 'Video._setNativeVideo ---', `url: ${url}`);
            const options = NSDictionary.dictionaryWithDictionary({
                AVURLAssetHTTPHeaderFieldsKey: this._headers
            });
            const asset = AVURLAsset.alloc().initWithURLOptions(url, options);
            const item = AVPlayerItem.playerItemWithAsset(asset);
            nativeVideoPlayer = item;
        }
        if (nativeVideoPlayer != null) {
            const currentItem = this.player.currentItem;
            this._addStatusObserver(nativeVideoPlayer);
            this._autoplayCheck();
            this._videoFinished = false;
            if (currentItem !== null) {
                this.videoLoaded = false;
                this._videoPlaying = false;
                this._removeStatusObserver(currentItem);
                this.player.replaceCurrentItemWithPlayerItem(null);
                this.player.replaceCurrentItemWithPlayerItem(nativeVideoPlayer);
            }
            else {
                this.player.replaceCurrentItemWithPlayerItem(nativeVideoPlayer);
                this._init();
            }
        }
    }
    updateAsset(nativeVideoAsset) {
        CLog(CLogTypes.info, 'Video.updateAsset ---', `nativeVideoAsset: ${nativeVideoAsset}`);
        const newPlayerItem = AVPlayerItem.playerItemWithAsset(nativeVideoAsset);
        this._setNativeVideo(newPlayerItem);
    }
    _setNativePlayerSource(nativePlayerSrc) {
        CLog(CLogTypes.info, 'Video._setNativePlayerSource ---', `nativePlayerSrc: ${nativePlayerSrc}`);
        this._src = nativePlayerSrc;
        const url = NSURL.URLWithString(this._src);
        this.player = AVPlayer.new();
        this._init();
    }
    play() {
        CLog(CLogTypes.info, 'Video.play');
        if (this._videoFinished) {
            this._videoFinished = false;
            this.seekToTime(5);
        }
        if (this.observeCurrentTime && !this._playbackTimeObserverActive) {
            this._addPlaybackTimeObserver();
        }
        this.player.play();
        this.sendEvent(VideoCommon.playbackStartEvent);
    }
    pause() {
        CLog(CLogTypes.info, 'Video.pause()');
        this.player.pause();
        this.sendEvent(VideoCommon.pausedEvent);
        if (this._playbackTimeObserverActive) {
            this._removePlaybackTimeObserver();
        }
    }
    mute(mute) {
        CLog(CLogTypes.info, 'Video.mute ---', `mute: ${mute}`);
        this.player.muted = mute;
        if (mute === true) {
            this.sendEvent(VideoCommon.mutedEvent);
        }
        else {
            this.sendEvent(VideoCommon.unmutedEvent);
        }
    }
    seekToTime(ms) {
        CLog(CLogTypes.info, 'Video.seekToTime ---', `ms: ${ms}`);
        const seconds = ms / 1000.0;
        const time = CMTimeMakeWithSeconds(seconds, this.player.currentTime().timescale);
        this.player.seekToTimeToleranceBeforeToleranceAfterCompletionHandler(time, kCMTimeZero, kCMTimeZero, isFinished => {
            CLog(CLogTypes.info, `Video.seekToTime ---`, 'emitting seekToTimeCompleteEvent');
            this.sendEvent(VideoCommon.seekToTimeCompleteEvent, { time: ms });
        });
    }
    getDuration() {
        const seconds = CMTimeGetSeconds(this.player.currentItem.asset.duration);
        const milliseconds = seconds * 1000.0;
        return milliseconds;
    }
    getCurrentTime() {
        if (this.player === null) {
            return false;
        }
        const result = (this.player.currentTime().value / this.player.currentTime().timescale) *
            1000;
        return result;
    }
    setVolume(volume) {
        CLog(CLogTypes.info, 'Video.setVolume ---', `volume: ${volume}`);
        this.player.volume = volume;
        this.sendEvent(VideoCommon.volumeSetEvent);
    }
    destroy() {
        CLog(CLogTypes.info, 'Video.destroy');
        this._removeStatusObserver(this.player.currentItem);
        if (this._didPlayToEndTimeActive) {
            Application.ios.removeNotificationObserver(this._didPlayToEndTimeObserver, AVPlayerItemDidPlayToEndTimeNotification);
            this._didPlayToEndTimeActive = false;
        }
        if (this._playbackTimeObserverActive) {
            this._removePlaybackTimeObserver();
        }
        this.pause();
        this.player.replaceCurrentItemWithPlayerItem(null);
        this._playerController = null;
        this.player = null;
    }
    getVideoSize() {
        const r = this._playerController.videoBounds;
        return {
            width: r.size.width,
            height: r.size.height
        };
    }
    _init() {
        CLog(CLogTypes.info, 'Video._init');
        if (this.controls !== false) {
            this._playerController.showsPlaybackControls = true;
        }
        if (this.fill === true) {
            this._playerController.videoGravity = AVLayerVideoGravityResizeAspectFill;
        }
        this._playerController.player = this.player;
        if (isNaN(parseInt(this.width.toString(), 10)) ||
            isNaN(parseInt(this.height.toString(), 10))) {
            this.requestLayout();
        }
        if (this.muted === true) {
            this.player.muted = true;
        }
        if (!this._didPlayToEndTimeActive) {
            this._didPlayToEndTimeObserver = Application.ios.addNotificationObserver(AVPlayerItemDidPlayToEndTimeNotification, this.AVPlayerItemDidPlayToEndTimeNotification.bind(this));
            this._didPlayToEndTimeActive = true;
        }
    }
    AVPlayerItemDidPlayToEndTimeNotification(notification) {
        CLog(CLogTypes.info, 'Video.AVPlayerItemDidPlayToEndTimeNotification ---', `notification: ${notification}`);
        if (this.player.currentItem &&
            this.player.currentItem === notification.object) {
            CLog(CLogTypes.info, 'Video.AVPlayerItemDidPlayToEndTimeNotification ---', 'emmitting finishedEvent');
            this.sendEvent(VideoCommon.finishedEvent);
            this._videoFinished = true;
            if (this.loop === true && this.player !== null) {
                this.player.seekToTime(CMTimeMake(5, 100));
                this.player.play();
            }
        }
    }
    _addStatusObserver(currentItem) {
        CLog(CLogTypes.info, 'Video._addStatusObserver ---', `currentItem: ${currentItem}`);
        this._observerActive = true;
        currentItem.addObserverForKeyPathOptionsContext(this._observer, 'status', 0, null);
    }
    _removeStatusObserver(currentItem) {
        CLog(CLogTypes.info, 'Video._removeStatusObserver ---', `currentItem: ${currentItem}`);
        this._observerActive = false;
        currentItem.removeObserverForKeyPath(this._observer, 'status');
    }
    _addPlaybackTimeObserver() {
        CLog(CLogTypes.info, 'Video._addPlaybackTimeObserver');
        this._playbackTimeObserverActive = true;
        const _interval = CMTimeMake(1, 5);
        this._playbackTimeObserver = this.player.addPeriodicTimeObserverForIntervalQueueUsingBlock(_interval, null, currentTime => {
            const _seconds = CMTimeGetSeconds(currentTime);
            const _milliseconds = _seconds * 1000.0;
            CLog(CLogTypes.info, `Video._addPlaybackTimeObserver ---`, 'emitting currentTimeUpdatedEvent');
            this.notify({
                eventName: VideoCommon.currentTimeUpdatedEvent,
                object: this,
                position: _milliseconds
            });
        });
    }
    _removePlaybackTimeObserver() {
        CLog(CLogTypes.info, 'Video._removePlaybackTimeObserver');
        this._playbackTimeObserverActive = false;
        this.player.removeTimeObserver(this._playbackTimeObserver);
    }
    _autoplayCheck() {
        CLog(CLogTypes.info, 'Video._autoplayCheck ---', `this.autoplay ${this.autoplay}`);
        if (this.autoplay) {
            this.play();
        }
    }
    playbackReady() {
        this.videoLoaded = true;
        CLog(CLogTypes.info, `Video.playbackReady ---`, 'emitting playbackReadyEvent');
        this.sendEvent(VideoCommon.playbackReadyEvent);
    }
    playbackStart() {
        this._videoPlaying = true;
        CLog(CLogTypes.info, `Video.playbackStart ---`, 'emitting playbackStartEvent');
        this.sendEvent(VideoCommon.playbackStartEvent);
    }
    setMode(mode, fill) {
        if (this.mode !== mode) {
            let transform = CGAffineTransformIdentity;
            if (mode === 'LANDSCAPE') {
                transform = CGAffineTransformRotate(transform, (90 * 3.14159265358979) / 180);
                this._playerController.view.transform = transform;
                const newFrame = CGRectMake(0, 0, this.nativeView.bounds.size.width, this.nativeView.bounds.size.height);
                this.nativeView.frame = newFrame;
            }
            else if (this.mode !== mode && mode === 'PORTRAIT') {
                transform = CGAffineTransformRotate(transform, (0 * 3.14159265358979) / 180);
                this._playerController.view.transform = transform;
                const newFrame = CGRectMake(0, 0, this.nativeView.bounds.size.height, this.nativeView.bounds.size.width);
                this.nativeView.frame = newFrame;
            }
            this.mode = mode;
        }
        if (this.fill !== fill) {
            if (fill) {
                this._playerController.videoGravity = AVLayerVideoGravityResizeAspectFill;
            }
            else {
                this._playerController.videoGravity = AVLayerVideoGravityResizeAspect;
            }
            this.fill = fill;
        }
    }
}
var PlayerObserverClass = /** @class */ (function (_super) {
    __extends(PlayerObserverClass, _super);
    function PlayerObserverClass() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PlayerObserverClass.prototype.observeValueForKeyPathOfObjectChangeContext = function (path, obj, change, context) {
        CLog(CLogTypes.info, 'PlayerObserverClass.observeValueForKeyPathOfObjectChangeContext ---', "path: " + path + ", obj: " + obj + ", change: " + change + ", context: " + context);
        if (path === 'status') {
            var owner = this.owner;
            if (owner.player.currentItem.status === AVPlayerItemStatus.Failed) {
                var baseError = owner.player.currentItem.error.userInfo.objectForKey(NSUnderlyingErrorKey);
                var error = new Error();
                owner.sendEvent(VideoCommon.errorEvent, {
                    error: {
                        code: baseError.code,
                        domain: baseError.domain
                    },
                    stack: error.stack
                });
            }
            if (owner.player &&
                owner.player.currentItem.status === AVPlayerItemStatus.ReadyToPlay &&
                !owner.videoLoaded) {
                owner.playbackReady();
            }
        }
    };
    return PlayerObserverClass;
}(NSObject));
//# sourceMappingURL=videoplayer.ios.js.map