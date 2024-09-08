import { Application, knownFolders, path as nsFilePath, Utils } from '@nativescript/core';
import { CLog, CLogTypes } from '../videoplayer-common';
export * from './video-source-common';
export class VideoSource {
    loadFromResource(name) {
        CLog(CLogTypes.info, `VideoSource.loadFromResource ---`, `name: ${name}`);
        this.android = null;
        const res = Utils.android.getApplicationContext().getResources();
        if (res) {
            const packageName = Application.android.context.getPackageName();
            const UrlPath = `android.resource://${packageName}/R.raw.${name}`;
            CLog(CLogTypes.info, `VideoSource.loadFromResource ---`, `UrlPath: ${UrlPath}`);
            this.android = UrlPath;
        }
        return this.android != null;
    }
    loadFromUrl(url) {
        CLog(CLogTypes.info, `VideoSource.loadFromUrl ---`, `url: ${url}`);
        this.android = null;
        this.android = url;
        return this.android != null;
    }
    loadFromFile(path) {
        CLog(CLogTypes.info, `VideoSource.loadFromFile ---`, `path: ${path}`);
        let fileName = Utils.isString(path) ? path.trim() : '';
        if (fileName.indexOf('~/') === 0) {
            fileName = nsFilePath.join(knownFolders.currentApp().path, fileName.replace('~/', ''));
            CLog(CLogTypes.info, `VideoSource.loadFromFile ---`, `fileName: ${fileName}`);
        }
        this.android = fileName;
        return this.android != null;
    }
    setNativeSource(source) {
        CLog(CLogTypes.info, `VideoSource.setNativeSource ---`, `source: ${source}`);
        this.android = source;
        return source != null;
    }
    get height() {
        if (this.android) {
            const h = this.android.getHeight();
            CLog(CLogTypes.info, `VideoSource.height --- returning ${h}`);
            return h;
        }
        return NaN;
    }
    get width() {
        if (this.android) {
            const w = this.android.getWidth();
            CLog(CLogTypes.info, `VideoSource.width --- returning ${w}`);
            return w;
        }
        return NaN;
    }
}
//# sourceMappingURL=video-source.android.js.map