export interface ProfileData {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
}

export function renderProfileIcon(
	container: HTMLElement,
	profile: ProfileData | null,
	onClick?: () => void
): HTMLElement {
	const wrapper = container.createEl("div", { cls: "semble-profile-icon" });

	if (!profile) {
		// Fallback when no profile data
		const placeholder = wrapper.createEl("div", { cls: "semble-avatar-placeholder" });
		placeholder.createEl("span", { text: "?" });
		return wrapper;
	}

	// Avatar button
	const avatarBtn = wrapper.createEl("button", { cls: "semble-avatar-btn" });

	if (profile.avatar) {
		const img = avatarBtn.createEl("img", { cls: "semble-avatar-img" });
		img.src = profile.avatar;
		img.alt = profile.displayName || profile.handle;
	} else {
		// Fallback initials
		const initials = (profile.displayName || profile.handle)
			.split(" ")
			.map(w => w[0])
			.slice(0, 2)
			.join("")
			.toUpperCase();
		avatarBtn.createEl("span", { text: initials, cls: "semble-avatar-initials" });
	}

	// User info (display name and handle)
	const info = wrapper.createEl("div", { cls: "semble-profile-info" });

	if (profile.displayName) {
		info.createEl("span", { text: profile.displayName, cls: "semble-profile-name" });
	}

	info.createEl("span", { text: `@${profile.handle}`, cls: "semble-profile-handle" });

	if (onClick) {
		avatarBtn.addEventListener("click", onClick);
	}

	return wrapper;
}
