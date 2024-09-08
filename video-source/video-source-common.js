import { Utils } from '@nativescript/core';
import { VideoSource } from './video-source';
export function fromResource(name) {
    const video = new VideoSource();
    return video.loadFromResource(name) ? video : null;
}
export function fromFile(path) {
    const video = new VideoSource();
    return video.loadFromFile(path) ? video : null;
}
export function fromNativeSource(source) {
    const video = new VideoSource();
    return video.setNativeSource(source) ? video : null;
}
export function fromUrl(url) {
    const video = new VideoSource();
    return video.loadFromUrl(url) ? video : null;
}
export function fromFileOrResource(path) {
    if (!isFileOrResourcePath(path)) {
        throw new Error(`Path: ${path} is not a valid file or resource.`);
    }
    if (path.indexOf(Utils.RESOURCE_PREFIX) === 0) {
        return fromResource(path.substr(Utils.RESOURCE_PREFIX.length));
    }
    return fromFile(path);
}
export function isFileOrResourcePath(path) {
    return Utils.isFileOrResourcePath(path);
}
//# sourceMappingURL=video-source-common.js.map