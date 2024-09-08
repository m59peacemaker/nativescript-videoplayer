import { Utils } from '@nativescript/core';
import { CLog, CLogTypes, headersProperty, VideoCommon, videoSourceProperty } from './videoplayer-common';
const STATE_IDLE = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
const SURFACE_WAITING = 0;
const SURFACE_READY = 1;
export class Video extends VideoCommon {
    constructor() {
        super();
        this.nativeView = null;
        this.player = null;
        this._src = '';
        this._owner = new WeakRef(this);
        this.textureSurface = null;
        this.mediaController = null;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this._headers = null;
        this.playState = STATE_IDLE;
        this.mediaState = SURFACE_WAITING;
        this.audioSession = -1;
        this.preSeekTime = -1;
        this.currentBufferPercentage = 0;
        this._playbackTimeObserver = null;
        this._playbackTimeObserverActive = false;
    }
    [headersProperty.setNative](value) {
        this._setHeader(value ? value : null);
    }
    [videoSourceProperty.setNative](value) {
        this._setNativeVideo(value ? value.android : null);
    }
    createNativeView() {
        CLog(CLogTypes.info, 'Video.createNativeView');
        this.nativeView = new android.view.TextureView(this._context);
        this.nativeView.setFocusable(true);
        this.nativeView.setFocusableInTouchMode(true);
        this.nativeView.requestFocus();
        this.nativeView.setOnTouchListener(new android.view.View.OnTouchListener({
            onTouch: (view, event) => {
                CLog(CLogTypes.info, 'OnTouchListener --- onTouch', `view: ${view}, event: ${event}`);
                this._owner.get().toggleMediaControllerVisibility();
                return false;
            }
        }));
        this.nativeView.setSurfaceTextureListener(new android.view.TextureView.SurfaceTextureListener({
            onSurfaceTextureSizeChanged: (surface, width, height) => {
                CLog(CLogTypes.info, 'SurfaceTextureListener.onSurfaceTextureSizeChanged ---', `surface: ${surface}, width: ${width}, height: ${height}`);
                if (this._owner.get().fill === true) {
                    this._owner.get()._resetAspectRatio();
                } else {
                    this._owner.get()._setupAspectRatio();
                }
            },
            onSurfaceTextureAvailable: (surface, width, height) => {
                CLog(CLogTypes.info, 'SurfaceTextureListener.onSurfaceTextureAvailable ---', `surface: ${surface}`);
                this._owner.get().textureSurface = new android.view.Surface(surface);
                this._owner.get().mediaState = SURFACE_WAITING;
                this._owner.get()._openVideo();
            },
            onSurfaceTextureDestroyed: surface => {
                CLog(CLogTypes.info, 'SurfaceTextureListener.onSurfaceTextureDestroyed ---', `surface: ${surface}`);
                if (this._owner.get().textureSurface !== null) {
                    this._owner.get().textureSurface.release();
                    this._owner.get().textureSurface = null;
                }
                if (this._owner.get().mediaController !== null) {
                    this._owner.get().mediaController.hide();
                }
                this._owner.get().release();
                return true;
            },
            onSurfaceTextureUpdated: () => {
            }
        }));
        return this.nativeView;
    }
    toggleMediaControllerVisibility() {
        CLog(CLogTypes.info, 'Video.toggleMediaControllerVisibility');
        if (!this.mediaController) {
            return;
        }
        if (this.mediaController.isShowing()) {
            this.mediaController.hide();
        }
        else {
            this.mediaController.show();
        }
    }
    play() {
        CLog(CLogTypes.info, 'Video.play');
        this.playState = STATE_PLAYING;
        if (this.mediaState === SURFACE_WAITING) {
            this._openVideo();
        }
        else {
            if (this.observeCurrentTime && !this._playbackTimeObserverActive) {
                this._addPlaybackTimeObserver();
            }
            this.player.start();
            CLog(CLogTypes.info, 'Video.play ---  emitting playbackStartEvent');
            this.sendEvent(VideoCommon.playbackStartEvent);
        }
    }
    pause() {
        this.playState = STATE_PAUSED;
        this.player.pause();
        this.sendEvent(VideoCommon.pausedEvent);
        this._removePlaybackTimeObserver();
    }
    mute(mute) {
        if (this.player) {
            if (mute === true) {
                this.player.setVolume(0, 0);
                this.sendEvent(VideoCommon.mutedEvent);
            }
            else if (mute === false) {
                this.player.setVolume(1, 1);
                this.sendEvent(VideoCommon.unmutedEvent);
            }
        }
    }
    stop() {
        this.player.stop();
        this._removePlaybackTimeObserver();
        this.playState = STATE_IDLE;
        this.release();
    }
    seekToTime(ms) {
        if (!this.player) {
            this.preSeekTime = ms;
            return;
        }
        else {
            this.preSeekTime = -1;
        }
        this.player.seekTo(ms);
        CLog(CLogTypes.info, 'Video.play ---  emitting seekToTimeCompleteEvent');
        this.sendEvent(VideoCommon.seekToTimeCompleteEvent, { time: ms });
    }
    isPlaying() {
        if (!this.player) {
            return false;
        }
        return this.player.isPlaying();
    }
    getDuration() {
        if (!this.player ||
            this.mediaState === SURFACE_WAITING ||
            this.playState === STATE_IDLE) {
            return 0;
        }
        return this.player.getDuration();
    }
    getCurrentTime() {
        if (!this.player) {
            return 0;
        }
        return this.player.getCurrentPosition();
    }
    setVolume(volume) {
        this.player.setVolume(volume, volume);
        this.sendEvent(VideoCommon.volumeSetEvent);
    }
    destroy() {
        this.release();
        this.src = null;
        this.nativeView = null;
        this.player = null;
        this.mediaController = null;
    }
    getVideoSize() {
        return {
            width: this.videoWidth,
            height: this.videoHeight
        };
    }
    release() {
        if (this.player !== null) {
            this.mediaState = SURFACE_WAITING;
            this.player.reset();
            this.player.release();
            this.player = null;
            if (this._playbackTimeObserverActive) {
                this._removePlaybackTimeObserver();
            }
            const am = Utils.android
                .getApplicationContext()
                .getSystemService(android.content.Context.AUDIO_SERVICE);
            am.abandonAudioFocus(null);
        }
    }
    suspendEvent() {
        this.release();
    }
    resumeEvent() {
        this._openVideo();
    }
    setNativeSource(nativePlayerSrc) {
        this._src = nativePlayerSrc;
        this._openVideo();
    }
    _setupMediaPlayerListeners() {
        CLog(CLogTypes.info, 'Video._setupMediaPlayerListeners');
        this.player.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener({
            onPrepared: mp => {
                CLog(CLogTypes.info, 'MediaPlayer.OnPreparedListener.onPrepared ---', `mp: ${mp}`);
                if (this._owner.get()) {
                    if (this._owner.get().muted === true) {
                        mp.setVolume(0, 0);
                    }
                    if (this._owner.get().mediaController != null) {
                        this._owner.get().mediaController.setEnabled(true);
                    }
                    if (this._owner.get().preSeekTime > 0) {
                        mp.seekTo(this._owner.get().preSeekTime);
                    }
                    this._owner.get().preSeekTime = -1;
                    this._owner.get().videoWidth = mp.getVideoWidth();
                    this._owner.get().videoHeight = mp.getVideoHeight();
                    this._owner.get().mediaState = SURFACE_READY;
                    if (this._owner.get().fill === true) {
                        this._owner.get()._resetAspectRatio();
                    }
                    else {
                        this._owner.get()._setupAspectRatio();
                    }
                    if (this._owner.get().videoWidth !== 0 &&
                        this._owner.get().videoHeight !== 0) {
                        this._owner
                            .get()
                            .nativeView.getSurfaceTexture()
                            .setDefaultBufferSize(this._owner.get().videoWidth, this._owner.get().videoHeight);
                    }
                    if (this._owner.get().autoplay === true ||
                        this._owner.get().playState === STATE_PLAYING) {
                        this._owner.get().play();
                    }
                    CLog(CLogTypes.info, 'Video.play ---  emitting playbackReadyEvent');
                    this._owner.get().sendEvent(VideoCommon.playbackReadyEvent);
                    if (this._owner.get().loop === true) {
                        mp.setLooping(true);
                    }
                }
            }
        }));
        this.player.setOnSeekCompleteListener(new android.media.MediaPlayer.OnSeekCompleteListener({
            onSeekComplete: mp => {
                CLog(CLogTypes.info, 'MediaPlayer.OnSeekCompleteListener.onSeekComplete ---', `mp: ${mp}`);
                if (this._owner.get()) {
                    CLog(CLogTypes.info, 'Video.play ---  emitting seekToTimeCompleteEvent');
                    this._owner.get().sendEvent(VideoCommon.seekToTimeCompleteEvent);
                }
            }
        }));
        this.player.setOnVideoSizeChangedListener(new android.media.MediaPlayer.OnVideoSizeChangedListener({
            onVideoSizeChanged: (mp, width, height) => {
                CLog(CLogTypes.info, 'MediaPlayer.setOnVideoSizeChangedListener.onVideoSizeChanged ---', `mp: ${mp}, width: ${width}, heigth: ${height}`);
                if (this._owner.get()) {
                    this._owner.get().videoWidth = mp.getVideoWidth();
                    this._owner.get().videoHeight = mp.getVideoHeight();
                    if (this._owner.get().videoWidth !== 0 &&
                        this._owner.get().videoHeight !== 0) {
                        this._owner
                            .get()
                            .nativeView.getSurfaceTexture()
                            .setDefaultBufferSize(this._owner.get().videoWidth, this._owner.get().videoHeight);
                        if (this._owner.get().fill === true) {
                            this._owner.get()._resetAspectRatio();
                        }
                        else {
                            this._owner.get()._setupAspectRatio();
                        }
                    }
                }
            }
        }));
        this.player.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener({
            onCompletion: mp => {
                CLog(CLogTypes.info, 'MediaPlayer.OnCompletionListener.onCompletion ---', `mp: ${mp}`);
                if (this._owner.get()) {
                    this._owner.get()._removePlaybackTimeObserver();
                    CLog(CLogTypes.info, 'Video.play ---  emitting finishedEvent');
                    this._owner.get().sendEvent(VideoCommon.finishedEvent);
                }
            }
        }));
        this.player.setOnBufferingUpdateListener(new android.media.MediaPlayer.OnBufferingUpdateListener({
            onBufferingUpdate: (mp, percent) => {
                CLog(CLogTypes.info, 'MediaPlayer.OnBufferingUpdateListener.onBufferingUpdate ---', `mp: ${mp}, percent: ${percent}`);
                this._owner.get().currentBufferPercentage = percent;
            }
        }));
        this.currentBufferPercentage = 0;
    }
    _setupMediaController() {
        CLog(CLogTypes.info, 'Video._setupMediaController');
        if (this.controls !== false || this.controls === undefined) {
            if (this.mediaController == null) {
                CLog(CLogTypes.info, 'Video._setupMediaController ---', 'creating new MediaController');
                this.mediaController = new android.widget.MediaController(this._context);
            }
            else {
                return;
            }
            const mediaPlayerControl = new android.widget.MediaController.MediaPlayerControl({
                canPause: () => {
                    return true;
                },
                canSeekBackward: () => {
                    return true;
                },
                canSeekForward: () => {
                    return true;
                },
                getAudioSessionId: () => {
                    return this._owner.get().audioSession;
                },
                getBufferPercentage: () => {
                    return this._owner.get().currentBufferPercentage;
                },
                getCurrentPosition: () => {
                    return this._owner.get().getCurrentTime();
                },
                getDuration: () => {
                    return this._owner.get().getDuration();
                },
                isPlaying: () => {
                    return this._owner.get().isPlaying();
                },
                pause: () => {
                    this._owner.get().pause();
                },
                seekTo: v => {
                    this._owner.get().seekToTime(v);
                },
                start: () => {
                    this._owner.get().play();
                }
            });
            CLog(CLogTypes.info, `Video._setupMediaController ---`, `mediaController.setMediaPlayer(${mediaPlayerControl})`);
            this.mediaController.setMediaPlayer(mediaPlayerControl);
            CLog(CLogTypes.info, `Video._setupMediaController ---`, `mediaController.setAnchorView(${this.nativeView})`);
            this.mediaController.setAnchorView(this.nativeView);
            CLog(CLogTypes.info, `Video._setupMediaController ---`, `mediaController.setEnabled(true)`);
            this.mediaController.setEnabled(true);
        }
    }
    _setupAspectRatio() {
        CLog(CLogTypes.info, `Video._setupAspectRatio`);
        const viewWidth = this.nativeView.getWidth();
        const viewHeight = this.nativeView.getHeight();
        const aspectRatio = this.videoHeight / this.videoWidth;
        CLog(CLogTypes.info, `Video._setupAspectRatio ---`, `viewHeight: ${viewHeight}, viewWidth: ${viewWidth}, aspectRatio: ${aspectRatio}`);
        let newWidth;
        let newHeight;
        if (viewHeight > viewWidth * aspectRatio) {
            newWidth = viewWidth;
            newHeight = viewWidth * aspectRatio;
        }
        else {
            newWidth = viewHeight / aspectRatio;
            newHeight = viewHeight;
        }
        CLog(CLogTypes.info, `Video._setupAspectRatio ---`, `newWidth: ${newWidth}, newHeight: ${newHeight}`);
        const xoff = (viewWidth - newWidth) / 2;
        const yoff = (viewHeight - newHeight) / 2;
        CLog(CLogTypes.info, `Video._setupAspectRatio ---`, `xoff: ${xoff}, yoff: ${yoff}`);
        const txform = new android.graphics.Matrix();
        CLog(CLogTypes.info, `Video._setupAspectRatio ---`, `txform: ${txform}, txform: ${txform}`);
        this.nativeView.getTransform(txform);
        txform.setScale(newWidth / viewWidth, newHeight / viewHeight);
        txform.postTranslate(xoff, yoff);
        this.nativeView.setTransform(txform);
    }
    _resetAspectRatio() {
        const viewWidth = this.nativeView.getWidth();
        const viewHeight = this.nativeView.getHeight();
        const aspectRatio = this.videoWidth / this.videoHeight;
        let newWidth;
        let newHeight;
        newHeight = viewHeight;
        newWidth = viewHeight * aspectRatio;
        const xoff = (viewWidth - newWidth) / 2;
        const yoff = (viewHeight - newHeight) / 2;
        const txform = new android.graphics.Matrix();
        txform.setScale(newWidth / viewWidth, newHeight / viewHeight);
        txform.postTranslate(xoff, yoff);
        this.nativeView.setTransform(txform);
    }
    _openVideo() {
        if (this._src === null ||
            this.textureSurface === null ||
            (this._src !== null &&
                typeof this._src === 'string' &&
                this._src.length === 0)) {
            return;
        }
        CLog(CLogTypes.info, `Video._openVideo`);
        this.release();
        const am = Utils.android
            .getApplicationContext()
            .getSystemService(android.content.Context.AUDIO_SERVICE);
        am.requestAudioFocus(null, android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.AUDIOFOCUS_GAIN);
        try {
            this.player = new android.media.MediaPlayer();
            CLog(CLogTypes.info, `Video._openVideo ---`, `this.player: ${this.player}`);
            if (this.audioSession !== null) {
                CLog(CLogTypes.info, `Video._openVideo ---`, `setting audio session Id: ${this.audioSession}`);
                this.player.setAudioSessionId(this.audioSession);
            }
            else {
                this.audioSession = this.player.getAudioSessionId();
            }
            CLog(CLogTypes.info, `Video._openVideo --- `, `setting up MediaPlayerListeners`);
            this._setupMediaPlayerListeners();
            if (!this._headers || this._headers.size() === 0) {
                this.player.setDataSource(this._src);
            }
            else {
                const videoUri = android.net.Uri.parse(this._src);
                this.player.setDataSource(Utils.android.getApplicationContext(), videoUri, this._headers);
            }
            this.player.setSurface(this.textureSurface);
            this.player.setAudioStreamType(android.media.AudioManager.STREAM_MUSIC);
            this.player.setScreenOnWhilePlaying(true);
            this.player.prepareAsync();
            this.player.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener({
                onError: (mp, what, extra) => {
                    const error = new Error();
                    this._owner.get().sendEvent(VideoCommon.errorEvent, {
                        error: { what: what, extra: extra },
                        stack: error.stack
                    });
                    return true;
                }
            }));
            this._setupMediaController();
        }
        catch (ex) {
            CLog(CLogTypes.error, `Video._openVideo --- error: ${ex}, stack: ${ex.stack}`);
            this._owner
                .get()
                .sendEvent(VideoCommon.errorEvent, { error: ex, stack: ex.stack });
        }
    }
    _setNativeVideo(nativeVideo) {
        CLog(CLogTypes.error, `Video._setNativeVideo`);
        this._src = nativeVideo;
        this._openVideo();
    }
    _setHeader(headers) {
        CLog(CLogTypes.error, `Video._setHeader ---`, `headers: ${headers}`);
        if (headers && headers.size > 0) {
            this._headers = new java.util.HashMap();
            headers.forEach((value, key) => {
                this._headers.put(key, value);
            });
        }
        if (this._src) {
            this._openVideo();
        }
    }
    _addPlaybackTimeObserver() {
        CLog(CLogTypes.error, `Video._addPlaybackTimeObserver`);
        this._playbackTimeObserverActive = true;
        this._playbackTimeObserver = Utils.setInterval(() => {
            if (this.player.isPlaying) {
                const _milliseconds = this.player.getCurrentPosition();
                this.notify({
                    eventName: VideoCommon.currentTimeUpdatedEvent,
                    object: this,
                    position: _milliseconds
                });
            }
        }, 500);
    }
    _removePlaybackTimeObserver() {
        CLog(CLogTypes.error, `Video._removePlaybackTimeObserver`);
        if (this._playbackTimeObserverActive) {
            if (this.player !== null) {
                const _milliseconds = this.player.getCurrentPosition();
                CLog(CLogTypes.info, 'Video._removePlaybackTimeObserver', 'emitting currentTimeUpdatedEvent');
                this.sendEvent(VideoCommon.currentTimeUpdatedEvent, {
                    currentPosition: _milliseconds
                });
            }
            Utils.clearInterval(this._playbackTimeObserver);
            this._playbackTimeObserverActive = false;
        }
    }
    setMode(mode, fill) {
        const viewWidth = this.nativeView.getWidth();
        const viewHeight = this.nativeView.getHeight();
        if (mode === 'LANDSCAPE') {
            this.configureTransform(viewWidth, viewHeight, true, fill);
        }
        else if (mode === 'PORTRAIT') {
            this.configureTransform(viewWidth, viewHeight, false, fill);
        }
        this.mode = mode;
        this.fill = fill;
    }
    configureTransform(viewWidth, viewHeight, isLandscape, fill) {
        const matrix = new android.graphics.Matrix();
        const viewRect = new android.graphics.RectF(0, 0, viewWidth, viewHeight);
        let bufferRect;
        if (isLandscape) {
            bufferRect = new android.graphics.RectF(0, 0, viewHeight, viewWidth);
        }
        else {
            bufferRect = new android.graphics.RectF(0, 0, viewWidth, viewHeight);
        }
        const centerX = viewRect.centerX();
        const centerY = viewRect.centerY();
        let scaleX, scaleY;
        const currentHeight = (viewWidth * this.videoHeight) / this.videoWidth;
        const currentWidth = viewWidth;
        if (isLandscape) {
            if (fill) {
                scaleX = viewHeight / currentHeight;
                scaleY =
                    (currentWidth * this.videoHeight) / this.videoWidth / currentWidth;
                if (scaleY * currentWidth < viewWidth) {
                    scaleY = viewWidth / currentWidth;
                    scaleX =
                        (scaleY * currentWidth * this.videoWidth) /
                            this.videoHeight /
                            currentHeight;
                }
                else if (scaleX * currentHeight < viewHeight) {
                    scaleX = viewHeight / currentHeight;
                    scaleY =
                        (scaleX * currentHeight * this.videoHeight) /
                            this.videoWidth /
                            currentWidth;
                }
            }
            else {
                scaleX = viewHeight / currentHeight;
                scaleY =
                    (scaleX * currentHeight * this.videoHeight) /
                        this.videoWidth /
                        currentWidth;
                if (scaleY * currentWidth > viewWidth) {
                    scaleY = viewWidth / currentWidth;
                    scaleX =
                        (currentWidth * this.videoWidth) / this.videoHeight / currentHeight;
                }
            }
        }
        else {
            if (fill) {
                scaleY = 1;
                scaleX =
                    (viewHeight * this.videoWidth) / this.videoHeight / currentWidth;
            }
            else {
                scaleX = viewWidth / currentWidth;
                scaleY =
                    (currentWidth * this.videoHeight) / this.videoWidth / viewHeight;
            }
        }
        bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY());
        matrix.setRectToRect(viewRect, bufferRect, android.graphics.Matrix.ScaleToFit.CENTER);
        matrix.postScale(scaleX, scaleY, centerX, centerY);
        if (isLandscape) {
            matrix.postRotate(90, centerX, centerY);
        }
        else {
            matrix.postRotate(0, centerX, centerY);
        }
        this.nativeView.setTransform(matrix);
    }
}
//# sourceMappingURL=videoplayer.android.js.map
