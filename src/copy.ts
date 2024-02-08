import {
    App,
    arrayBufferToBase64, Component,
    FileSystemAdapter,
    MarkdownRenderer,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting, TAbstractFile,
    TFile
} from 'obsidian';

enum FootnoteHandling {
    /** Remove references and links */
    REMOVE_ALL,

    /** Reference links to footnote using a unique id */
    LEAVE_LINK,

    /** Links are removed from reference and back-link from footnote */
    REMOVE_LINK,

    /** Footnote is moved to title attribute */
    TITLE_ATTRIBUTE
}


/** Don't allow multiple copy processes to run at the same time */
let copyIsRunning = false;


const MERMAID_STYLESHEET = `
:root {
  --default-font: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
  --font-monospace: 'Source Code Pro', monospace;
  --background-primary: #ffffff;
  --background-modifier-border: #ddd;
  --text-accent: #705dcf;
  --text-accent-hover: #7a6ae6;
  --text-normal: #2e3338;
  --background-secondary: #f2f3f5;
  --background-secondary-alt: #e3e5e8;
  --text-muted: #888888;
  --font-mermaid: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
  --text-error: #E4374B;
  --background-primary-alt: '#fafafa';
  --background-accent: '';
  --interactive-accent: hsl( 254,  80%, calc( 68% + 2.5%));
  --background-modifier-error: #E4374B;
}
`;

/**
 * Static assets
 */

const DEFAULT_STYLESHEET =
    `body,input {
  font-family: "Roboto","Helvetica Neue",Helvetica,Arial,sans-serif
}

code, kbd, pre {
  font-family: "Roboto Mono", "Courier New", Courier, monospace;
  background-color: #f5f5f5;
}

pre {
  padding: 1em 0.5em;
}

table {
  background: white;
  border: 1px solid #666;
  border-collapse: collapse;
  padding: 0.5em;
}

table thead th,
table tfoot th {
  text-align: left;
  background-color: #eaeaea;
  color: black;
}

table th, table td {
  border: 1px solid #ddd;
  padding: 0.5em;
}

table td {
  color: #222222;
}

.callout[data-callout="abstract"] .callout-title,
.callout[data-callout="summary"] .callout-title,
.callout[data-callout="tldr"]  .callout-title,
.callout[data-callout="faq"] .callout-title,
.callout[data-callout="info"] .callout-title,
.callout[data-callout="help"] .callout-title {
  background-color: #828ee7;
}
.callout[data-callout="tip"] .callout-title,
.callout[data-callout="hint"] .callout-title,
.callout[data-callout="important"] .callout-title {
  background-color: #34bbe6;
}
.callout[data-callout="success"] .callout-title,
.callout[data-callout="check"] .callout-title,
.callout[data-callout="done"] .callout-title {
  background-color: #a3e048;
}
.callout[data-callout="question"] .callout-title,
.callout[data-callout="todo"] .callout-title {
  background-color: #49da9a;
}
.callout[data-callout="caution"] .callout-title,
.callout[data-callout="attention"] .callout-title {
  background-color: #f7d038;
}
.callout[data-callout="warning"] .callout-title,
.callout[data-callout="missing"] .callout-title,
.callout[data-callout="bug"] .callout-title {
  background-color: #eb7532;
}
.callout[data-callout="failure"] .callout-title,
.callout[data-callout="fail"] .callout-title,
.callout[data-callout="danger"] .callout-title,
.callout[data-callout="error"] .callout-title {
  background-color: #e6261f;
}
.callout[data-callout="example"] .callout-title {
  background-color: #d23be7;
}
.callout[data-callout="quote"] .callout-title,
.callout[data-callout="cite"] .callout-title {
  background-color: #aaaaaa;
}

.callout-icon {
  flex: 0 0 auto;
  display: flex;
  align-self: center;
}

svg.svg-icon {
  height: 18px;
  width: 18px;
  stroke-width: 1.75px;
}

.callout {
  overflow: hidden;
  margin: 1em 0;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.callout-title {
  padding: .5em;
  display: flex;
  gap: 8px;
  font-size: inherit;
  color: black;
  line-height: 1.3em;
}

.callout-title-inner {
  font-weight: bold;
  color: black;
}

.callout-content {
  overflow-x: auto;
  padding: 0.25em .5em;
  color: #222222;
  background-color: white !important;
}

ul.contains-task-list {
  padding-left: 0;
  list-style: none;
}

ul.contains-task-list ul.contains-task-list {
  padding-left: 2em;
}

ul.contains-task-list li input[type="checkbox"] {
  margin-right: .5em;
}

.callout-table,
.callout-table tr,
.callout-table p {
  width: 100%;
  padding: 0;
}

.callout-table td {
  width: 100%;
  padding: 0 1em;
}

.callout-table p {
  padding-bottom: 0.5em;
}

.source-table {
  width: 100%;
  background-color: #f5f5f5;
}
`;

type CopyDocumentAsHTMLSettings = {
    /** Remove front-matter */
    removeFrontMatter: boolean;

    /** Remove titles from embedded links */
    removeLinkText: boolean;

    /** If set svg are converted to bitmap */
    convertSvgToBitmap: boolean;

    /** Render some elements as tables */
    formatAsTables: boolean;

    /** Embed external links (load them and embed their content) */
    embedExternalLinks: boolean;

    /** Remove dataview meta-data lines (format : `some-tag:: value` */
    removeDataviewMetadataLines: boolean;

    /** How are foot-notes displayed ? */
    footnoteHandling: FootnoteHandling;

    /** remember if the stylesheet was default or custom */
    useCustomStylesheet: boolean;

    /** Style-sheet */
    styleSheet: string;

    /** Only generate the HTML body, don't include the <head> section */
    bareHtmlOnly: boolean;

    /** Include filename in copy. Only when entire document is copied */
    fileNameAsHeader: boolean;
}

const DEFAULT_SETTINGS: CopyDocumentAsHTMLSettings = {
    removeFrontMatter: true,
    removeLinkText: false,
    convertSvgToBitmap: true,
    useCustomStylesheet: false,
    embedExternalLinks: false,
    removeDataviewMetadataLines: false,
    formatAsTables: false,
    footnoteHandling: FootnoteHandling.REMOVE_LINK,
    styleSheet: DEFAULT_STYLESHEET,
    bareHtmlOnly: false,
    fileNameAsHeader: false
}

const htmlTemplate = (stylesheet: string, body: string, title: string) => `<html>
<head>
  <title>${title}</title>
  <style>
    ${MERMAID_STYLESHEET}
    ${stylesheet}
  </style>
</head>
<body>
${body}
</body>
</html>`;

const documentRendererDefaults = {
    convertSvgToBitmap: true,
    removeFrontMatter: true,
    removeLinkText: false,
    formatAsTables: false,
    embedExternalLinks: false,
    removeDataviewMetadataLines: false,
    footnoteHandling: FootnoteHandling.REMOVE_LINK
};

/**
 * Options for DocumentRenderer
 */
type DocumentRendererOptions = {
    convertSvgToBitmap: boolean,
    removeFrontMatter: boolean,
    removeLinkText: boolean,
    formatAsTables: boolean,
    embedExternalLinks: boolean,
    removeDataviewMetadataLines: boolean,
    footnoteHandling: FootnoteHandling,
};

export class CopyHandler {
    private view: Component;

    // time required after last block was rendered before we decide that rendering a view is completed
    private optionRenderSettlingDelay: number = 100;

    // only those which are different from image/${extension}
    private readonly mimeMap = new Map([
        ['svg', 'image/svg+xml'],
        ['jpg', 'image/jpeg'],
    ]);

    private readonly externalSchemes = ['http', 'https'];

    private readonly vaultPath: string;
    private readonly vaultUriPrefix: string;

    constructor(private app: App,
        private options: DocumentRendererOptions = documentRendererDefaults) {
        this.vaultPath = (this.app.vault.getRoot().vault.adapter as FileSystemAdapter).getBasePath()
            .replace(/\\/g, '/');

        this.vaultUriPrefix = `app://local/${this.vaultPath}`;

        this.view = new Component();
    }
    async doCopy(markdown: string, file: TAbstractFile, isFullDocument: boolean) {
        let path = file.path;
        let name = file.name;
        console.log(`Copying "${path}" to clipboard...`);
        const title = name.replace(/\.md$/i, '');

        const copier = new DocumentRenderer(this.app, DEFAULT_SETTINGS);
        try {
            copyIsRunning = true;


            let htmlBody = await copier.renderDocument(markdown, path);
            console.log("htmlbody:", htmlBody);

            const htmlDocument = htmlTemplate(DEFAULT_STYLESHEET, htmlBody.outerHTML, title);
            return htmlDocument;
        } catch (error) {
            new Notice(`copy failed: ${error}`);
            console.error('copy failed', error);
        } finally {
            copyIsRunning = false;
        }
    }

}

/**
 * Render markdown to DOM, with some clean-up and embed images as data uris.
 */
class DocumentRenderer {
    private view: Component;

    // time required after last block was rendered before we decide that rendering a view is completed
    private optionRenderSettlingDelay: number = 100;

    // only those which are different from image/${extension}
    private readonly mimeMap = new Map([
        ['svg', 'image/svg+xml'],
        ['jpg', 'image/jpeg'],
    ]);

    private readonly externalSchemes = ['http', 'https'];

    private readonly vaultPath: string;
    private readonly vaultUriPrefix: string;

    constructor(private app: App,
        private options: DocumentRendererOptions = documentRendererDefaults) {
        this.vaultPath = (this.app.vault.getRoot().vault.adapter as FileSystemAdapter).getBasePath()
            .replace(/\\/g, '/');

        this.vaultUriPrefix = `app://local/${this.vaultPath}`;

        this.view = new Component();
    }

    /**
     * Render document into detached HTMLElement
     */
    public async renderDocument(markdown: string, path: string): Promise<HTMLElement> {
        const topNode = await this.renderMarkdown(markdown, path);
        return await this.transformHTML(topNode!);
    }

    /**
     * Render current view into HTMLElement, expanding embedded links
     */
    private async renderMarkdown(markdown: string, path: string): Promise<HTMLElement> {
        const processedMarkdown = this.preprocessMarkdown(markdown);

        const wrapper = document.createElement('div');
        wrapper.style.display = 'hidden';
        document.body.appendChild(wrapper);
        await MarkdownRenderer.render(this.app, processedMarkdown, wrapper, path, this.view);
        await this.untilRendered();
        const result = wrapper.cloneNode(true) as HTMLElement;
        document.body.removeChild(wrapper);
        this.view.unload();
        return result;
    }

    private preprocessMarkdown(markdown: string): string {
        let processed = markdown;

        if (this.options.removeDataviewMetadataLines) {
            processed = processed.replace(/^[^ \t:#`<>][^:#`<>]+::.*$/gm, '');
        }

        return processed;
    }

    /**
     * Wait until the view has finished rendering
     *
     * Beware, this is a dirty hack...
     *
     * We have no reliable way to know if the document finished rendering. For instance dataviews or task blocks
     * may not have been post processed.
     * MarkdownPostProcessors are called on all the "blocks" in the HTML view. So we register one post-processor
     * with high-priority (low-number to mark the block as being processed), and another one with low-priority that
     * runs after all other post-processors.
     * Now if we see that no blocks are being post-processed, it can mean 2 things :
     *  - either we are between blocks
     *  - or we finished rendering the view
     * On the premise that the time that elapses between the post-processing of consecutive blocks is always very
     * short (just iteration, no work is done), we conclude that the render is finished if no block has been
     * rendered for enough time.
     */
    private async untilRendered() {
        // while (ppIsProcessing || Date.now() - ppLastBlockDate < this.optionRenderSettlingDelay) {
        //     if (ppLastBlockDate === 0) {
        //         break;
        //     }
        await delay(20);
        // }
    }

    /**
     * Transform rendered markdown to clean it up and embed images
     */
    private async transformHTML(element: HTMLElement): Promise<HTMLElement> {
        // Remove styling which forces the preview to fill the window vertically
        // @ts-ignore
        const node: HTMLElement = element.cloneNode(true);
        node.removeAttribute('style');

        if (this.options.removeFrontMatter) {
            this.removeFrontMatter(node);
        }

        this.replaceInternalLinks(node);
        this.makeCheckboxesReadOnly(node);
        this.removeCollapseIndicators(node);
        this.removeButtons(node);
        this.removeStrangeNewWorldsLinks(node);

        if (this.options.formatAsTables) {
            this.transformCodeToTables(node);
            this.transformCalloutsToTables(node);
        }

        if (this.options.footnoteHandling == FootnoteHandling.REMOVE_ALL) {
            this.removeAllFootnotes(node);
        }
        if (this.options.footnoteHandling == FootnoteHandling.REMOVE_LINK) {
            this.removeFootnoteLinks(node);
        } else if (this.options.footnoteHandling == FootnoteHandling.TITLE_ATTRIBUTE) {
            // not supported yet
        }

        await this.embedImages(node);
        await this.renderSvg(node);
        return node;
    }

    /** Remove front-matter */
    private removeFrontMatter(node: HTMLElement) {
        node.querySelectorAll('.frontmatter, .frontmatter-container')
            .forEach(node => node.remove());
    }

    private replaceInternalLinks(node: HTMLElement) {
        node.querySelectorAll('a.internal-link')
            .forEach(node => {
                const textNode = node.parentNode!.createEl('span');
                textNode.innerText = node.getText();
                textNode.className = 'internal-link';
                node.parentNode!.replaceChild(textNode, node);
            });
    }

    private makeCheckboxesReadOnly(node: HTMLElement) {
        node.querySelectorAll('input[type="checkbox"]')
            .forEach(node => node.setAttribute('disabled', 'disabled'));
    }

    /** Remove the collapse indicators from HTML, not needed (and not working) in copy */
    private removeCollapseIndicators(node: HTMLElement) {
        node.querySelectorAll('.collapse-indicator')
            .forEach(node => node.remove());
    }

    /** Remove button elements (which appear after code blocks) */
    private removeButtons(node: HTMLElement) {
        node.querySelectorAll('button')
            .forEach(node => node.remove());
    }

    /** Remove counters added by Strange New Worlds plugin (https://github.com/TfTHacker/obsidian42-strange-new-worlds) */
    private removeStrangeNewWorldsLinks(node: HTMLElement) {
        node.querySelectorAll('.snw-reference')
            .forEach(node => node.remove());
    }

    /** Transform code blocks to tables */
    private transformCodeToTables(node: HTMLElement) {
        node.querySelectorAll('pre')
            .forEach(node => {
                const codeEl = node.querySelector('code');
                if (codeEl) {
                    const code = codeEl.innerHTML.replace(/\n*$/, '');
                    const table = node.parentElement!.createEl('table');
                    table.className = 'source-table';
                    table.innerHTML = `<tr><td><pre>${code}</pre></td></tr>`;
                    node.parentElement!.replaceChild(table, node);
                }
            });
    }

    /** Transform callouts to tables */
    private transformCalloutsToTables(node: HTMLElement) {
        node.querySelectorAll('.callout')
            .forEach(node => {
                const callout = node.parentElement!.createEl('table');
                callout.addClass('callout-table', 'callout');
                callout.setAttribute('data-callout', node.getAttribute('data-callout') ?? 'quote');
                const headRow = callout.createEl('tr');
                const headColumn = headRow.createEl('td');
                headColumn.addClass('callout-title');
                // const img = node.querySelector('svg');
                const title = node.querySelector('.callout-title-inner');

                // if (img) {
                // 	headColumn.appendChild(img);
                // }

                if (title) {
                    const span = headColumn.createEl('span');
                    span.innerHTML = title.innerHTML;
                }

                const originalContent = node.querySelector('.callout-content');
                if (originalContent) {
                    const row = callout.createEl('tr');
                    const column = row.createEl('td');
                    column.innerHTML = originalContent.innerHTML;
                }

                node.replaceWith(callout);
            });
    }

    /** Remove references to footnotes and the footnotes section */
    private removeAllFootnotes(node: HTMLElement) {
        node.querySelectorAll('section.footnotes')
            .forEach(section => section.parentNode!.removeChild(section));

        node.querySelectorAll('.footnote-link')
            .forEach(link => {
                link.parentNode!.parentNode!.removeChild(link.parentNode!);
            });
    }

    /** Keep footnotes and references, but remove links */
    private removeFootnoteLinks(node: HTMLElement) {
        node.querySelectorAll('.footnote-link')
            .forEach(link => {
                const text = link.getText();
                if (text === '↩︎') {
                    // remove back-link
                    link.parentNode!.removeChild(link);
                } else {
                    // remove from reference
                    const span = link.parentNode!.createEl('span', { text: link.getText(), cls: 'footnote-link' })
                    link.parentNode!.replaceChild(span, link);
                }
            });
    }

    /** Replace all images sources with a data-uri */
    private async embedImages(node: HTMLElement): Promise<HTMLElement> {
        const promises: Promise<void>[] = [];

        // Replace all image sources
        node.querySelectorAll('img')
            .forEach(img => {
                if (img.src) {
                    if (img.src.startsWith('data:image/svg+xml') && this.options.convertSvgToBitmap) {
                        // image is an SVG, encoded as a data uri. This is the case with Excalidraw for instance.
                        // Convert it to bitmap
                        promises.push(this.replaceImageSource(img));
                        return;
                    }

                    if (!this.options.embedExternalLinks) {
                        const [scheme] = img.src.split(':', 1);
                        if (this.externalSchemes.includes(scheme.toLowerCase())) {
                            // don't touch external images
                            return;
                        } else {
                            // not an external image, continue processing below
                        }
                    }

                    if (!img.src.startsWith('data:')) {
                        // render bitmaps, except if already as data-uri
                        promises.push(this.replaceImageSource(img));
                        return;
                    }
                }
            });

        // @ts-ignore
        // this.modal.progress.max = 100;

        // @ts-ignore
        // await allWithProgress(promises, percentCompleted => this.modal.progress.value = percentCompleted);
        return node;
    }

    private async renderSvg(node: HTMLElement): Promise<Element> {
        const xmlSerializer = new XMLSerializer();

        if (!this.options.convertSvgToBitmap) {
            return node;
        }

        const promises: Promise<void>[] = [];

        const replaceSvg = async (svg: SVGSVGElement) => {
            let style: HTMLStyleElement = svg.querySelector('style') || svg.appendChild(document.createElement('style'));
            style.innerHTML += MERMAID_STYLESHEET;

            const svgAsString = xmlSerializer.serializeToString(svg);

            const svgData = `data:image/svg+xml;base64,` + Buffer.from(svgAsString).toString('base64');
            const dataUri = await this.imageToDataUri(svgData);

            const img = svg.createEl('img');
            img.style.cssText = svg.style.cssText;
            img.src = dataUri;

            svg.parentElement!.replaceChild(img, svg);
        };

        node.querySelectorAll('svg')
            .forEach(svg => {
                promises.push(replaceSvg(svg));
            });

        // @ts-ignore
        // this.modal.progress.max = 0;

        // @ts-ignore
        // await allWithProgress(promises, percentCompleted => this.modal.progress.value = percentCompleted);
        return node;
    }

    /** replace image src attribute with data uri */
    private async replaceImageSource(image: HTMLImageElement): Promise<void> {
        const imageSourcePath = decodeURI(image.src);

        if (imageSourcePath.startsWith(this.vaultUriPrefix)) {
            // Transform uri to Obsidian relative path
            let path = imageSourcePath.substring(this.vaultUriPrefix.length + 1)
                .replace(/[?#].*/, '');
            path = decodeURI(path);

            const mimeType = this.guessMimeType(path);
            const data = await this.readFromVault(path, mimeType);

            if (this.isSvg(mimeType) && this.options.convertSvgToBitmap) {
                // render svg to bitmap for compatibility w/ for instance gmail
                image.src = await this.imageToDataUri(data);
            } else {
                // file content as base64 data uri (including svg)
                image.src = data;
            }
        } else {
            // Attempt to render uri to canvas. This is not an uri that points to the vault. Not needed for public
            // urls, but we may have un uri that points to our local machine or network, that will not be accessible
            // wherever we intend to paste the document.
            image.src = await this.imageToDataUri(image.src);
        }
    }

    /**
     * Draw image url to canvas and return as data uri containing image pixel data
     */
    private async imageToDataUri(url: string): Promise<string> {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');

        const dataUriPromise = new Promise<string>((resolve, reject) => {
            image.onload = () => {
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;

                ctx!.drawImage(image, 0, 0);

                try {
                    const uri = canvas.toDataURL('image/png');
                    resolve(uri);
                } catch (err) {
                    // leave error at `log` level (not `error`), since we leave an url that may be workable
                    console.log(`failed ${url}`, err);
                    // if we fail, leave the original url.
                    // This way images that we may not load from external sources (tainted) may still be accessed
                    // (eg. plantuml)
                    // TODO: should we attempt to fallback with fetch ?
                    resolve(url);
                }

                canvas.remove();
            }

            image.onerror = (err) => {
                console.log('could not load data uri');
                // if we fail, leave the original url
                resolve(url);
            }
        })

        image.src = url;

        return dataUriPromise;
    }

    /**
     * Get binary data as b64 from a file in the vault
     */
    private async readFromVault(path: string, mimeType: string): Promise<string> {
        const tfile = this.app.vault.getAbstractFileByPath(path) as TFile;
        const data = await this.app.vault.readBinary(tfile);
        return `data:${mimeType};base64,` + arrayBufferToBase64(data);
    }

    /** Guess an image's mime-type based on its extension */
    private guessMimeType(filePath: string): string {
        const extension = this.getExtension(filePath) || 'png';
        return this.mimeMap.get(extension) || `image/${extension}`;
    }

    /** Get lower-case extension for a path */
    private getExtension(filePath: string): string {
        // avoid using the "path" library
        const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
        return fileName.slice(fileName.lastIndexOf('.') + 1 || fileName.length)
            .toLowerCase();
    }

    private isSvg(mimeType: string): boolean {
        return mimeType === 'image/svg+xml';
    }
}


/**
 * Do nothing for a while
 */
async function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}