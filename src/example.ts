import { ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";

import Component from "./component/Component.svelte";

export const VIEW_TYPE_EXAMPLE = "example-view";

export class ExampleView extends ItemView {
    view: Component;
    private markdown: string;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_EXAMPLE;
    }

    getDisplayText() {
        return "Example view";
    }

    getIcon(): string {
        return "clock";
    }

    async onOpen() {
        this.view = new Component({
            target: this.contentEl,
            props: {
                markdown: this.markdown
            }
        });
    }

    async onClose() {
        this.view.$destroy();
    }

    setMarkdown(markdown: string) {
        this.view.$set({
            markdown: markdown
        });
    }
}