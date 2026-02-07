export function renderLoginMessage(container: HTMLElement) {
	const message = container.createEl("div", { cls: "atmosphere-auth-required" });
	message.createEl("p", { text: "Please log in by opening Atmosphere settings" });
}
