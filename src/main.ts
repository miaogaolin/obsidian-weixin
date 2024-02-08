import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, PluginManifest, TAbstractFile } from 'obsidian';

import { ExampleView, VIEW_TYPE_EXAMPLE } from 'example';

import { CopyHandler } from 'copy';

// Remember to rename these classes and interfaces!

interface WeixinPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: WeixinPluginSettings = {
	mySetting: 'default'
}

export default class WeixinPlugin extends Plugin {
	settings: WeixinPluginSettings;

	private exmaple: ExampleView;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
	}
	async onload() {
		this.setupUI();
		this.setupCommands();

		await this.loadSettings();

		this.app.workspace.onLayoutReady(() => {
			this.watch();
		});

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');



		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private setupCommands() {
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addCommand({
			id: 'copy-to-weixin',
			name: 'Copy to Weixin',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.getActiveMarkdownView();
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						console.log(markdownView.data);
					}
					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});
	}

	private getActiveMarkdownView() {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		return markdownView;
	}

	private setupUI() {
		this.registerView(VIEW_TYPE_EXAMPLE, (leaf: WorkspaceLeaf) => {
			this.exmaple = new ExampleView(leaf);
			return this.exmaple;
		});

		this.app.workspace.onLayoutReady(() => {
			if (this.app.workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE).length == 0) {
				this.app.workspace.getRightLeaf(false).setViewState({
					type: VIEW_TYPE_EXAMPLE,
				});
			}
		});

	}

	private watch() {
		[
			this.app.vault.on("modify", async (file: TAbstractFile) => {
				let markdownView = this.getActiveMarkdownView();
				let copyHandler = new CopyHandler(this.app);
				let mardown = await copyHandler.doCopy(markdownView?.data, file, true);
				this.exmaple.setMarkdown(mardown);
			}),
			this.app.vault.on("delete", (file) => {
				console.log("delete:", file);
			}),
			this.app.vault.on("rename", async (file, oldPath) => {
				console.log("rename:", file, oldPath);
			}),
			this.app.workspace.on("file-open", async (file: TAbstractFile) => {
				if (file?.extension != "md") {
					return;
				}
				const fileContent = await this.app.vault.read(file);
				let copyHandler = new CopyHandler(this.app);
				let markdown = await copyHandler.doCopy(fileContent, file, true);
				this.exmaple.setMarkdown(markdown);
				console.log("file-open:", markdown);
			}),
		].forEach(eventRef => {
			this.registerEvent(eventRef);
		})
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: WeixinPlugin;

	constructor(app: App, plugin: WeixinPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
