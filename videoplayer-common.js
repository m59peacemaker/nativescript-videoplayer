import { booleanConverter, Property, Utils, View } from '@nativescript/core';
import { fromFileOrResource, fromNativeSource, fromUrl, VideoSource } from './video-source/video-source';
export class VideoPlayerUtil {
}
VideoPlayerUtil.debug = false;
export var CLogTypes;
(function (CLogTypes) {
    CLogTypes[CLogTypes["info"] = 0] = "info";
    CLogTypes[CLogTypes["warning"] = 1] = "warning";
    CLogTypes[CLogTypes["error"] = 2] = "error";
})(CLogTypes || (CLogTypes = {}));
export const CLog = (type = 0, ...args) => {
    if (VideoPlayerUtil.debug) {
        if (type === 0) {
            console.log('NativeScript-VideoPlayer: INFO', args);
        }
        else if (type === 1) {
            console.log('NativeScript-VideoPlayer: WARNING', args);
        }
        else if (type === 2) {
            console.log('NativeScript-VideoPlayer: ERROR', args);
        }
    }
};
export class VideoCommon extends View {
    constructor() {
        super(...arguments);
        this.autoplay = false;
        this.controls = true;
        this.loop = false;
        this.muted = false;
        this.fill = false;
        this.mode = 'PORTRAIT';
    }
    set debug(value) {
        VideoPlayerUtil.debug = value;
    }
    sendEvent(eventName, data, msg) {
        this.notify({
            eventName,
            object: this,
            data,
            message: msg,
        });
    }
}
VideoCommon.errorEvent = 'errorEvent';
VideoCommon.playbackReadyEvent = 'playbackReady';
VideoCommon.playbackStartEvent = 'playbackStart';
VideoCommon.seekToTimeCompleteEvent = 'seekToTimeComplete';
VideoCommon.currentTimeUpdatedEvent = 'currentTimeUpdated';
VideoCommon.finishedEvent = 'finishedEvent';
VideoCommon.mutedEvent = 'mutedEvent';
VideoCommon.unmutedEvent = 'unmutedEvent';
VideoCommon.pausedEvent = 'pausedEvent';
VideoCommon.volumeSetEvent = 'volumeSetEvent';
export const srcProperty = new Property({
    name: 'src',
    valueChanged: onSrcPropertyChanged,
});
srcProperty.register(VideoCommon);
export const headersProperty = new Property({
    name: 'headers',
    valueChanged: onHeadersPropertyChanged,
});
headersProperty.register(VideoCommon);
export const videoSourceProperty = new Property({
    name: 'videoSource',
});
videoSourceProperty.register(VideoCommon);
export const isLoadingProperty = new Property({
    name: 'isLoading',
    valueConverter: booleanConverter,
});
isLoadingProperty.register(VideoCommon);
export const observeCurrentTimeProperty = new Property({
    name: 'observeCurrentTime',
    valueConverter: booleanConverter,
});
observeCurrentTimeProperty.register(VideoCommon);
export const autoplayProperty = new Property({
    name: 'autoplay',
    valueConverter: booleanConverter,
});
autoplayProperty.register(VideoCommon);
export const controlsProperty = new Property({
    name: 'controls',
    valueConverter: booleanConverter,
});
controlsProperty.register(VideoCommon);
export const loopProperty = new Property({
    name: 'loop',
    valueConverter: booleanConverter,
});
loopProperty.register(VideoCommon);
export const mutedProperty = new Property({
    name: 'muted',
    valueConverter: booleanConverter,
});
mutedProperty.register(VideoCommon);
export const fillProperty = new Property({
    name: 'fill',
    valueConverter: booleanConverter,
});
fillProperty.register(VideoCommon);
function onSrcPropertyChanged(view, oldValue, newValue) {
    CLog(CLogTypes.info, 'VideoCommon.onSrcPropertyChanged ---', `view: ${view}, oldValue: ${oldValue}, newValue: ${newValue}`);
    const video = view;
    let value = newValue;
    if (Utils.isString(value)) {
        value = value.trim();
        video.videoSource = null;
        video['_url'] = value;
        video.isLoadingProperty = true;
        if (Utils.isFileOrResourcePath(value)) {
            video.videoSource = fromFileOrResource(value);
            video.isLoadingProperty = false;
        }
        else {
            if (video['_url'] === value) {
                video.videoSource = fromUrl(value);
                video.isLoadingProperty = false;
            }
        }
    }
    else if (value instanceof VideoSource) {
        video.videoSource = value;
    }
    else {
        video.videoSource = fromNativeSource(value);
    }
}
function onHeadersPropertyChanged(view, oldValue, newValue) {
    CLog(CLogTypes.info, 'VideoCommon.onHeadersPropertyChanged ---', `view: ${view}, oldValue: ${oldValue}, newValue: ${newValue}`);
    const video = view;
    if (oldValue !== newValue) {
        if (video.src) {
            onSrcPropertyChanged(view, null, null);
            onSrcPropertyChanged(view, null, video.src);
        }
    }
}
//# sourceMappingURL=videoplayer-common.js.map