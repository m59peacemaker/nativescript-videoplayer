import { knownFolders, path as nsFilePath, Utils } from '@nativescript/core';
import { CLog, CLogTypes } from '../videoplayer-common';
export * from './video-source-common';
export class VideoSource {
    loadFromResource(name) {
        CLog(CLogTypes.info, `VideoSource.loadFromResource --- name ${name}`);
        const videoURL = NSBundle.mainBundle.URLForResourceWithExtension(name, null);
        const player = AVPlayerItem.playerItemWithURL(videoURL);
        this.ios = player;
        return this.ios != null;
    }
    loadFromFile(path) {
        CLog(CLogTypes.info, `VideoSource.loadFromFile --- path ${path}`);
        let fileName = Utils.isString(path) ? path.trim() : '';
        if (fileName.indexOf('~/') === 0) {
            fileName = nsFilePath.join(knownFolders.currentApp().path, fileName.replace('~/', ''));
            CLog(CLogTypes.info, `VideoSource.loadFromFile --- fileName ${fileName}`);
        }
        const videoURL = NSURL.fileURLWithPath(fileName);
        const player = AVPlayerItem.playerItemWithURL(videoURL);
        this.ios = player;
        return this.ios != null;
    }
    loadFromUrl(url) {
        CLog(CLogTypes.info, `VideoSource.loadFromUrl --- url ${url}`);
        const videoURL = NSURL.URLWithString(url);
        const player = AVPlayerItem.playerItemWithURL(videoURL);
        this.ios = player;
        return this.ios != null;
    }
    setNativeSource(source) {
        CLog(CLogTypes.info, `VideoSource.setNativeSource --- source ${source}`);
        this.ios = source;
        return source != null;
    }
}
//# sourceMappingURL=video-source.ios.js.map